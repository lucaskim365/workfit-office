import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { CALENDAR_EVENT_SEED } from '@/data/seeds/calendarEvent.seed';
import { isValidCalendarDate } from '@/domain/calendarEvent/calendarDate';
import { calendarEventSchema, type CalendarEvent, type CalendarEventDraft } from '@/domain/calendarEvent/schema';

export interface CalendarEventActor {
  userId: string;
  active: boolean;
}

export interface CalendarEventFilter {
  from?: string;
  to?: string;
}

export class CalendarEventError extends Error {
  constructor(public readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_RANGE', message: string) {
    super(message);
    this.name = 'CalendarEventError';
  }
}

/** 일정 컬렉션. 문서 ID = `CalendarEvent.id`(`CAL-20260813-0001`). */
const COLL = 'calendarEvents';

let memory: CalendarEvent[] = CALENDAR_EVENT_SEED.map(cloneEvent);
let mutationQueue = Promise.resolve();

function cloneEvent(event: CalendarEvent): CalendarEvent {
  return { ...event };
}

function exclusiveMutation<T>(work: () => Promise<T>): Promise<T> {
  const next = mutationQueue.then(work, work);
  mutationQueue = next.then(() => undefined, () => undefined);
  return next;
}

/**
 * 전체 일정 로드(저장소 무관). Firebase 미설정 시 in-memory seed 로 graceful degrade.
 * ([[data-layer-pattern]] 정본 패턴)
 *
 * ⚠ 개인 일정이지만 **전건을 읽어 와서 소유자로 거른다.** 조회 규모가 커지면
 * `where('ownerUserId', '==', …)` 쿼리로 바꿔야 하고 그때 복합 인덱스가 필요하다.
 * 지금은 다른 repo 와 같은 모양을 유지해 이관 난이도를 낮춘다.
 */
async function loadAll(): Promise<CalendarEvent[]> {
  if (isFirebaseConfigured && db) {
    const fdb = db;
    const snap = await getDocs(collection(fdb, COLL));
    const out: CalendarEvent[] = [];
    for (const d of snap.docs) {
      const parsed = calendarEventSchema.safeParse(d.data());
      if (parsed.success) out.push(parsed.data);
    }
    return out;
  }
  return memory;
}

/** 한 건 저장(신규·수정 공통). */
async function persist(row: CalendarEvent): Promise<void> {
  if (isFirebaseConfigured && db) {
    const fdb = db;
    await setDoc(doc(fdb, COLL, row.id), row);
    return;
  }
  const index = memory.findIndex((item) => item.id === row.id);
  if (index >= 0) memory = memory.map((item, itemIndex) => (itemIndex === index ? row : item));
  else memory = [...memory, row];
}

/** 한 건 삭제. */
async function drop(id: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    const fdb = db;
    await deleteDoc(doc(fdb, COLL, id));
    return;
  }
  memory = memory.filter((row) => row.id !== id);
}

function requireActive(actor: CalendarEventActor): void {
  if (!actor.active) throw new CalendarEventError('FORBIDDEN', '사용 중인 계정만 일정을 변경할 수 있습니다.');
}

function requireOwned(rows: CalendarEvent[], actor: CalendarEventActor, id: string): CalendarEvent {
  const event = rows.find((row) => row.id === id);
  if (!event || event.ownerUserId !== actor.userId) {
    throw new CalendarEventError('NOT_FOUND', '일정을 찾을 수 없거나 접근 권한이 없습니다.');
  }
  return event;
}

function validateFilter(filter?: CalendarEventFilter): void {
  if (filter?.from && !isValidCalendarDate(filter.from)) {
    throw new CalendarEventError('INVALID_RANGE', '조회 시작일이 올바르지 않습니다.');
  }
  if (filter?.to && !isValidCalendarDate(filter.to)) {
    throw new CalendarEventError('INVALID_RANGE', '조회 종료일이 올바르지 않습니다.');
  }
  if (filter?.from && filter.to && filter.from > filter.to) {
    throw new CalendarEventError('INVALID_RANGE', '조회 종료일은 시작일보다 빠를 수 없습니다.');
  }
}

function nextId(rows: CalendarEvent[], date: string): string {
  const prefix = `CAL-${date.replaceAll('-', '')}-`;
  const max = rows
    .filter((row) => row.id.startsWith(prefix))
    .reduce((value, row) => Math.max(value, Number(row.id.slice(-4)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

function sortEvents(rows: CalendarEvent[]): CalendarEvent[] {
  return rows.sort((a, b) => (
    a.date.localeCompare(b.date)
    || Number(b.allDay) - Number(a.allDay)
    || (a.startTime ?? '').localeCompare(b.startTime ?? '')
    || a.id.localeCompare(b.id)
  ));
}

export const calendarEventRepo = {
  async list(actor: CalendarEventActor, filter?: CalendarEventFilter): Promise<CalendarEvent[]> {
    validateFilter(filter);
    if (!actor.active) return [];
    const rows = await loadAll();
    return sortEvents(rows
      .filter((event) => event.ownerUserId === actor.userId)
      .filter((event) => !filter?.from || event.date >= filter.from)
      .filter((event) => !filter?.to || event.date <= filter.to)
      .map(cloneEvent));
  },

  async get(actor: CalendarEventActor, id: string): Promise<CalendarEvent | null> {
    if (!actor.active) return null;
    const rows = await loadAll();
    const event = rows.find((row) => row.id === id && row.ownerUserId === actor.userId);
    return event ? cloneEvent(event) : null;
  },

  create(actor: CalendarEventActor, draft: CalendarEventDraft): Promise<CalendarEvent> {
    return exclusiveMutation(async () => {
      requireActive(actor);
      const rows = await loadAll();
      const now = new Date().toISOString();
      const created = calendarEventSchema.parse({
        ...draft,
        id: nextId(rows, draft.date),
        ownerUserId: actor.userId,
        createdAt: now,
        updatedAt: now,
      });
      await persist(created);
      return cloneEvent(created);
    });
  },

  update(actor: CalendarEventActor, id: string, draft: CalendarEventDraft): Promise<CalendarEvent> {
    return exclusiveMutation(async () => {
      requireActive(actor);
      const rows = await loadAll();
      const current = requireOwned(rows, actor, id);
      const updated = calendarEventSchema.parse({
        ...current,
        ...draft,
        id: current.id,
        ownerUserId: current.ownerUserId,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      });
      await persist(updated);
      return cloneEvent(updated);
    });
  },

  remove(actor: CalendarEventActor, id: string): Promise<CalendarEvent> {
    return exclusiveMutation(async () => {
      requireActive(actor);
      const rows = await loadAll();
      const current = requireOwned(rows, actor, id);
      await drop(id);
      return cloneEvent(current);
    });
  },
};
