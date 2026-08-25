import { CALENDAR_EVENT_SEED } from '@/data/seeds/calendarEvent.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';
import { isValidCalendarDate } from '@/domain/calendarEvent/calendarDate';
import { canViewEvent, type CalendarAccessContext } from '@/domain/calendarEvent/engine';
import { calendarEventSchema, type CalendarEvent, type CalendarEventDraft } from '@/domain/calendarEvent/schema';

/**
 * 일정 조회·변경 주체.
 *
 * `deptId`·`projectIds`는 공유 판정에만 쓰인다. 넘기지 않으면 부서·프로젝트 공유 일정이
 * 안 보일 뿐 내 일정은 그대로 보인다 — 공유를 아직 안 쓰는 호출부는 고치지 않아도 된다.
 */
export interface CalendarEventActor extends Partial<Pick<CalendarAccessContext, 'deptId' | 'projectIds'>> {
  userId: string;
  active: boolean;
}

const accessContextOf = (actor: CalendarEventActor): CalendarAccessContext => ({
  userId: actor.userId,
  deptId: actor.deptId ?? null,
  projectIds: actor.projectIds ?? [],
  active: actor.active,
});

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
 * 일정 컬렉션. 문서 ID = `CalendarEvent.id`(`CAL-20260813-0001`).
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임하고 파생 로직만 여기 유지한다.
 * ([[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 *
 * ⚠ 개인 일정이지만 **전건을 읽어 와서 소유자로 거른다.** 조회 규모가 커지면
 * `ownerUserId` 로 좁히는 질의가 필요하고 그때 인덱스도 함께 걸어야 한다.
 * 지금은 다른 repo 와 같은 모양을 유지해 이관 난이도를 낮춘다.
 */
const backend = createCrudBackend<CalendarEvent>({
  coll: 'calendarEvents',
  parse: (raw) => {
    const parsed = calendarEventSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  idOf: (row) => row.id,
  seed: CALENDAR_EVENT_SEED.map(cloneEvent),
});

const loadAll = (): Promise<CalendarEvent[]> => backend.loadAll();
const persist = (row: CalendarEvent): Promise<void> => backend.save(row);
const drop = (id: string): Promise<void> => backend.remove(id);

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
  /** 내 일정 + 나에게 공유된 일정. 공개 범위 판정은 도메인 `canViewEvent`가 맡는다. */
  async list(actor: CalendarEventActor, filter?: CalendarEventFilter): Promise<CalendarEvent[]> {
    validateFilter(filter);
    if (!actor.active) return [];
    const access = accessContextOf(actor);
    const rows = await loadAll();
    return sortEvents(rows
      .filter((event) => canViewEvent(access, event))
      .filter((event) => !filter?.from || event.date >= filter.from)
      .filter((event) => !filter?.to || event.date <= filter.to)
      .map(cloneEvent));
  },

  async get(actor: CalendarEventActor, id: string): Promise<CalendarEvent | null> {
    if (!actor.active) return null;
    const access = accessContextOf(actor);
    const rows = await loadAll();
    const event = rows.find((row) => row.id === id && canViewEvent(access, row));
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
