import { MEETING_DEFAULT_VISIBILITY } from '@/domain/calendarEvent/meeting';
import { calendarEventSchema, type CalendarEventDraft, type CalendarVisibility } from '@/domain/calendarEvent/schema';
import { OUTSIDE_WORK_SUBTYPES, outsideWorkSchema, type OutsideWorkDraft } from '@/domain/outsideWork/schema';
import type { OutsideScheduleView } from '@/domain/outsideWork/view';
import type { User } from '@/domain/user/schema';
import type { DayEntry } from '@/domain/workPlan/dayEntries';
import { workPlanItemSchema, type WorkPlanItemDraft } from '@/domain/workPlan/item';
import { toHHmm, toMinutes, type MinuteRange } from '@/domain/workPlan/timeGrid';

/*
  업무계획 일정 창의 순수 변환 — 창 상태 ↔ 저장 초안. 훅(useWorkPlanEventForm)은 이것만 써서
  상태를 만들고 저장 직전에 초안으로 바꾼다. 검증은 각 저장소 스키마를 그대로 써서 첫 오류 문구만 돌려준다.
*/

export type EventKind = 'ITEM' | 'MEETING' | 'OUTSIDE' | 'TRIP';

export type EventTarget =
  | { mode: 'create'; date: string; owner: User; allowed: EventKind[] } // 남의 칸이면 ['MEETING']
  | { mode: 'edit'; entry: DayEntry } // ITEM·MEETING·OUTSIDE(본인 등록)
  | { mode: 'view'; entry: DayEntry };

export interface EventFormState {
  kind: EventKind;
  tagId: string;
  title: string;
  date: string;
  endDate: string;
  allDay: boolean;
  range: MinuteRange | null;
  memo: string;
  attendeeIds: string[];
  visibility: CalendarVisibility;
  locationMode: 'text' | 'room';
  locationText: string;
  roomId: string | null;
  subType: string;
  destination: string;
  purpose: string;
  companionIds: string[];
  transportation: string;
  contact: string;
}

const isOutsideKind = (kind: EventKind): kind is 'OUTSIDE' | 'TRIP' => kind === 'OUTSIDE' || kind === 'TRIP';

function rangeOf(startTime: string | null | undefined, endTime: string | null | undefined): MinuteRange | null {
  if (!startTime || !endTime) return null;
  return { start: toMinutes(startTime), end: toMinutes(endTime) };
}

function blankState(date: string): EventFormState {
  return {
    kind: 'ITEM',
    tagId: '',
    title: '',
    date,
    endDate: date,
    allDay: false,
    range: null,
    memo: '',
    attendeeIds: [],
    visibility: MEETING_DEFAULT_VISIBILITY,
    locationMode: 'text',
    locationText: '',
    roomId: null,
    subType: '',
    destination: '',
    purpose: '',
    companionIds: [],
    transportation: '',
    contact: '',
  };
}

/** 새 일정 — 일반이 허용되면 일반(첫 일반 태그), 아니면 허용 목록 첫 값. 남의 칸이면 칸 주인을 참석자로. */
export function initialCreateState(
  target: Extract<EventTarget, { mode: 'create' }>,
  actorId: string,
  firstTagId: string,
): EventFormState {
  const kind: EventKind = target.allowed.includes('ITEM') ? 'ITEM' : target.allowed[0] ?? 'ITEM';
  const base = blankState(target.date);
  return {
    ...base,
    kind,
    tagId: firstTagId,
    allDay: isOutsideKind(kind),
    subType: isOutsideKind(kind) ? OUTSIDE_WORK_SUBTYPES[kind][0] : '',
    attendeeIds: target.owner.id !== actorId ? [target.owner.id] : [],
  };
}

function fromOutsideView(view: OutsideScheduleView, date: string): EventFormState {
  const self = view.self;
  if (self) {
    return {
      ...blankState(self.startDate),
      kind: self.category,
      endDate: self.endDate,
      allDay: self.allDay,
      range: self.allDay ? null : rangeOf(self.startTime, self.endTime),
      memo: self.memo,
      subType: self.subType,
      destination: self.destination,
      purpose: self.purpose,
      companionIds: [...self.companionUserIds],
      transportation: self.transportation,
      contact: self.contact,
    };
  }
  // 결재 완료 건(보기 전용) — 표시 모델에 있는 값만
  const range = rangeOf(view.startTime, view.endTime);
  return {
    ...blankState(view.startDate || date),
    kind: view.category,
    endDate: view.endDate || view.startDate || date,
    allDay: range === null,
    range,
    memo: view.memo ?? '',
    subType: view.subType,
    destination: view.destination ?? '',
    purpose: view.purpose ?? '',
    transportation: view.transportation ?? '',
    contact: view.contact ?? '',
  };
}

/**
 * 기존 칸 → 창 상태(수정·보기). `linkedRoomId` = 회의의 연결 예약이 잡은 회의실 자원 id
 * (예약을 찾았을 때만). 연결 예약이 있으면 회의실 선택으로 연다.
 */
export function initialStateFromEntry(entry: DayEntry, linkedRoomId: string | null): EventFormState {
  if (entry.item) {
    const item = entry.item;
    return {
      ...blankState(item.date),
      kind: 'ITEM',
      tagId: item.tagId,
      title: item.title,
      allDay: item.allDay,
      range: item.allDay ? null : rangeOf(item.startTime, item.endTime),
      memo: item.memo,
    };
  }
  if (entry.event) {
    const ev = entry.event;
    const roomMode = Boolean(ev.reservationId);
    return {
      ...blankState(ev.date),
      kind: 'MEETING',
      title: ev.title,
      allDay: ev.allDay,
      range: ev.allDay ? null : rangeOf(ev.startTime, ev.endTime),
      memo: ev.memo,
      attendeeIds: [...ev.attendeeUserIds],
      visibility: ev.visibility,
      locationMode: roomMode ? 'room' : 'text',
      locationText: ev.location ?? '',
      roomId: roomMode ? linkedRoomId : null,
    };
  }
  if (entry.outside) {
    return fromOutsideView(entry.outside, entry.schedule?.startDate ?? '');
  }
  return { ...blankState(''), title: entry.title };
}

/**
 * 종류 바꾸기. 새 일정은 허용 목록 안에서만, 수정은 같은 출처 안에서만(외근↔출장),
 * 보기는 바꾸지 않는다. 바꿀 수 없으면 같은 상태 객체를 그대로 돌려준다.
 */
export function switchKind(
  state: EventFormState,
  next: EventKind,
  rule: { mode: EventTarget['mode']; allowed: EventKind[] },
): EventFormState {
  if (state.kind === next || rule.mode === 'view') return state;
  if (rule.mode === 'create' && !rule.allowed.includes(next)) return state;
  if (rule.mode === 'edit' && !(isOutsideKind(state.kind) && isOutsideKind(next))) return state;
  return {
    ...state,
    kind: next,
    // 외근·출장 세부 구분은 구분이 바뀌면 첫 값으로
    subType: isOutsideKind(next) ? OUTSIDE_WORK_SUBTYPES[next][0] : state.subType,
    // 회의는 시각이 필수
    allDay: next === 'MEETING' ? false : state.allDay,
  };
}

function timesOf(state: EventFormState): { startTime: string | null; endTime: string | null } {
  if (state.allDay || !state.range) return { startTime: null, endTime: null };
  return { startTime: toHHmm(state.range.start), endTime: toHHmm(state.range.end) };
}

export function toItemDraft(state: EventFormState): WorkPlanItemDraft {
  return {
    date: state.date,
    allDay: state.allDay,
    ...timesOf(state),
    tagId: state.tagId,
    title: state.title,
    memo: state.memo,
  };
}

/** 회의 초안 — 종일 없음, 참석자에서 주최자 제외. 회의실이면 장소 = 방 이름(저장 때 예약 이름으로 맞춰진다). */
export function toMeetingDraft(
  state: EventFormState,
  ctx: { organizerId: string; deptId: string | null; roomName: string | null },
): CalendarEventDraft {
  const { startTime, endTime } = timesOf({ ...state, allDay: false });
  return {
    title: state.title,
    date: state.date,
    allDay: false,
    startTime,
    endTime,
    memo: state.memo,
    visibility: state.visibility,
    eventType: 'MEETING',
    attendeeUserIds: [...new Set(state.attendeeIds)].filter((id) => id !== ctx.organizerId),
    deptId: state.visibility === 'TEAM' ? ctx.deptId ?? null : null,
    projectId: null,
    location: state.locationMode === 'text' ? state.locationText.trim() || null : ctx.roomName,
  };
}

/** 회의실 예약 목적 — 안건(메모), 비면 "회의". */
export function meetingPurpose(state: EventFormState): string {
  return state.memo.trim() || '회의';
}

export function toOutsideDraft(state: EventFormState, actorId: string): OutsideWorkDraft {
  const category = isOutsideKind(state.kind) ? state.kind : 'OUTSIDE';
  return {
    category,
    subType: state.subType || OUTSIDE_WORK_SUBTYPES[category][0],
    startDate: state.date,
    endDate: state.endDate && state.endDate >= state.date ? state.endDate : state.date,
    allDay: state.allDay,
    ...timesOf(state),
    destination: state.destination,
    purpose: state.purpose,
    companionUserIds: state.companionIds.filter((id) => id !== actorId),
    transportation: state.transportation,
    contact: state.contact,
    memo: state.memo,
  };
}

const firstIssue = (issues: Array<{ message: string }>): string => issues[0]?.message || '입력값을 확인하세요.';

/** 저장 전 검증 — 통과면 null, 아니면 첫 오류 문구. */
export function validateItemDraft(draft: WorkPlanItemDraft, ownerId: string, actorId: string): string | null {
  if (!draft.tagId) return '태그를 고르세요.';
  const now = new Date().toISOString();
  const parsed = workPlanItemSchema.safeParse({
    ...draft, id: 'WI-00000000-0000', ownerUserId: ownerId, createdBy: actorId, createdAt: now, updatedAt: now,
  });
  return parsed.success ? null : firstIssue(parsed.error.issues);
}

export function validateMeetingDraft(draft: CalendarEventDraft, organizerId: string): string | null {
  const now = new Date().toISOString();
  const parsed = calendarEventSchema.safeParse({
    ...draft, id: 'CAL-00000000-0000', ownerUserId: organizerId, createdAt: now, updatedAt: now, reminded: false,
  });
  return parsed.success ? null : firstIssue(parsed.error.issues);
}

export function validateOutsideDraft(draft: OutsideWorkDraft, ownerId: string): string | null {
  const now = new Date().toISOString();
  const parsed = outsideWorkSchema.safeParse({ ...draft, id: 'OW-00000000-0000', ownerUserId: ownerId, createdAt: now, updatedAt: now });
  return parsed.success ? null : firstIssue(parsed.error.issues);
}
