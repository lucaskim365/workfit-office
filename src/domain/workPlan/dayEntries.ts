import { isDateInSchedule, type StandardScheduleInfo } from '@/domain/approvalDoc/scheduleEngine';
import type { CalendarEvent } from '@/domain/calendarEvent/schema';
import { isOfficialCalendarEvent } from '@/domain/calendarEvent/engine';
import { fromApprovalSchedule, fromOutsideWork, type OutsideScheduleView } from '@/domain/outsideWork/view';
import type { OutsideWork } from '@/domain/outsideWork/schema';
import type { Reservation } from '@/domain/reservation/schema';
import type { WorkPlanItem } from './item';
import { contentToMemo } from './memo';
import type { WorkPlan } from './schema';
import { resolveTag, type WorkPlanTag } from './tag';
import { isWorkPlanDerivedEvent } from './workPlanCalendarBridge';

export type DayEntrySource = 'MEETING' | 'CALENDAR' | 'OUTSIDE' | 'APPROVAL' | 'ITEM';

export interface DayEntry {
  /** 출처+원본id(+동행 사용자) — React key */
  key: string;
  source: DayEntrySource;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  /** 화면에 쓸 제목(회의 [회의]/[미팅] 접두 제거, 외근은 행선지) */
  title: string;
  /** ITEM만 */
  tag: { name: string; colorId: string; unknown: boolean } | null;
  /** 동행 칸이면 등록자 userId */
  companionOf?: string;
  /** MEETING에 연결 예약이 대기/반려일 때 */
  roomStatus: 'PENDING' | 'REJECTED' | null;
  item?: WorkPlanItem;
  event?: CalendarEvent;
  outside?: OutsideScheduleView;
  schedule?: StandardScheduleInfo;
}

export interface DayEntryInput {
  items: WorkPlanItem[];
  tags: WorkPlanTag[];
  events: CalendarEvent[];
  outsideWorks: OutsideWork[];
  approvedSchedules: StandardScheduleInfo[];
  legacyPlans: WorkPlan[];
  reservations: Reservation[];
  members: Array<{ id: string; name: string }>;
}

/** 그 사람·그 날의 메모 원본(`workPlans` 1건) — 고칠 때 쓴다 */
export interface MemoPlanRef {
  id: string;
  updatedAt: string;
}

export interface DayCell {
  entries: DayEntry[];
  /** 메모 글(서식 제거). 없으면 null */
  memo: string | null;
  /** 메모 원본 문서. 글이 비어 있어도 문서가 있으면 채운다(새로 만들면 겹치므로) */
  memoPlan: MemoPlanRef | null;
}

const SOURCE_ORDER: Record<DayEntrySource, number> = { MEETING: 0, CALENDAR: 1, OUTSIDE: 2, APPROVAL: 3, ITEM: 4 };

function compareEntries(a: DayEntry, b: DayEntry): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const at = a.startTime ?? '';
  const bt = b.startTime ?? '';
  if (at !== bt) return at < bt ? -1 : 1;
  if (a.source !== b.source) return SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
  return a.title.localeCompare(b.title, 'ko');
}

const COMPANY_OWNER = '__COMPANY__';
const EMPTY_CELL: DayCell = { entries: [], memo: null, memoPlan: null };

/**
 * 사람·날짜별 칸 목록을 한 번 훑어 만들고, 조회 함수를 돌려준다.
 * `dates`에 든 날짜만 담는다(칸마다 전체 배열을 다시 훑지 않는다).
 */
export function indexDayEntries(input: DayEntryInput, dates: string[]): (userId: string, date: string) => DayCell {
  const dateSet = new Set(dates);
  const map = new Map<string, DayEntry[]>();
  const memoMap = new Map<string, { memo: string | null; plan: MemoPlanRef }>();
  const push = (userId: string, date: string, entry: DayEntry) => {
    const k = `${userId}|${date}`;
    const list = map.get(k);
    if (list) list.push(entry);
    else map.set(k, [entry]);
  };

  const nameById = new Map(input.members.map((m) => [m.id, m.name]));
  const normName = (v?: string | null) => (v ?? '').replace(/\s+/g, '');
  const memberIdByName = new Map(input.members.map((m) => [normName(m.name), m.id]));
  const reservationById = new Map(input.reservations.map((r) => [r.id, r]));

  // 항목
  for (const item of input.items) {
    if (!dateSet.has(item.date)) continue;
    const tag = resolveTag(input.tags, item.tagId);
    push(item.ownerUserId, item.date, {
      key: `item-${item.id}`,
      source: 'ITEM',
      allDay: item.allDay,
      startTime: item.startTime,
      endTime: item.endTime,
      title: item.title,
      tag: { name: tag.name, colorId: tag.colorId, unknown: tag.unknown },
      roomStatus: null,
      item,
    });
  }

  // 캘린더 일정 — 회의(MEETING)와 그 외 공인 일정(CALENDAR). 업무계획에서 파생된 일정은 제외.
  for (const ev of input.events) {
    if (!dateSet.has(ev.date)) continue;
    if (!isOfficialCalendarEvent(ev) || isWorkPlanDerivedEvent(ev)) continue;
    const isMeeting = ev.eventType === 'MEETING';
    const reservation = ev.reservationId ? reservationById.get(ev.reservationId) : undefined;
    const roomStatus = reservation?.status === 'PENDING' || reservation?.status === 'REJECTED' ? reservation.status : null;
    const title = ev.title.replace(/^\[(회의|미팅)\]\s*/, '').trim() || ev.title;
    for (const userId of new Set([ev.ownerUserId, ...(ev.attendeeUserIds ?? [])])) {
      push(userId, ev.date, {
        key: `cal-${ev.id}-${userId}`,
        source: isMeeting ? 'MEETING' : 'CALENDAR',
        allDay: ev.allDay,
        startTime: ev.startTime,
        endTime: ev.endTime,
        title,
        tag: null,
        roomStatus: isMeeting ? roomStatus : null,
        event: ev,
      });
    }
  }

  // 직접 등록 외근·출장 — 결재와 연결된 건은 결재 쪽으로만 보인다
  for (const w of input.outsideWorks) {
    if (w.linkedApprovalDocId) continue;
    const view = fromOutsideWork(w, (id) => nameById.get(id));
    const rows = [
      { userId: w.ownerUserId, companionOf: undefined as string | undefined },
      ...w.companionUserIds.filter((id) => id !== w.ownerUserId).map((id) => ({ userId: id, companionOf: w.ownerUserId })),
    ];
    for (const date of dates) {
      if (date < w.startDate || date > w.endDate) continue;
      for (const row of rows) {
        push(row.userId, date, {
          key: `out-${w.id}-${row.userId}`,
          source: 'OUTSIDE',
          allDay: w.allDay,
          startTime: w.startTime,
          endTime: w.endTime,
          title: w.destination,
          tag: null,
          companionOf: row.companionOf,
          roomStatus: null,
          outside: view,
        });
      }
    }
  }

  // 결재 완료 일정 — 기안자 id가 지금 사용자 id와 다르면 이름으로 잇는다(근태와 같은 규칙)
  for (const s of input.approvedSchedules) {
    const ownerId = input.members.some((m) => m.id === s.drafterId)
      ? s.drafterId
      : memberIdByName.get(normName(s.drafterName)) ?? s.drafterId;
    const outside = fromApprovalSchedule(s) ?? undefined;
    const timed = Boolean(s.startTime && s.endTime);
    for (const date of dates) {
      if (!isDateInSchedule(date, s)) continue;
      push(ownerId, date, {
        key: `appr-${s.docId}-${ownerId}`,
        source: 'APPROVAL',
        allDay: !timed,
        startTime: timed ? s.startTime ?? null : null,
        endTime: timed ? s.endTime ?? null : null,
        title: s.category !== 'LEAVE' && s.destination ? s.destination : s.docTitle,
        tag: null,
        roomStatus: null,
        outside,
        schedule: s,
      });
    }
  }

  // 메모(전사 공통 줄은 대상 아님) — 같은 날 문서가 여럿이면 글이 있는 쪽을 쓴다
  for (const plan of input.legacyPlans) {
    if (plan.ownerUserId === COMPANY_OWNER || !dateSet.has(plan.date)) continue;
    const k = `${plan.ownerUserId}|${plan.date}`;
    const memo = contentToMemo(plan.content);
    if (memoMap.get(k)?.memo && !memo) continue;
    memoMap.set(k, { memo, plan: { id: plan.id, updatedAt: plan.updatedAt } });
  }

  for (const list of map.values()) list.sort(compareEntries);

  return (userId, date) => {
    const k = `${userId}|${date}`;
    const entries = map.get(k);
    const memo = memoMap.get(k);
    if (!entries && !memo) return EMPTY_CELL;
    return { entries: entries ?? [], memo: memo?.memo ?? null, memoPlan: memo?.plan ?? null };
  };
}

export function buildDayEntries(userId: string, date: string, input: DayEntryInput): DayCell {
  return indexDayEntries(input, [date])(userId, date);
}
