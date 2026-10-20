import { calendarEventRepo, CalendarEventError, type CalendarEventActor } from '@/data/calendarEvent/calendarEvent.repo';
import { reservationRepo } from '@/data/reservation/reservation.repo';
import { resourceRepo } from '@/data/resource/resource.repo';
import { calendarEventSchema, type CalendarEvent, type CalendarEventDraft } from '@/domain/calendarEvent/schema';
import { assertNoConflict, ReservationError } from '@/domain/reservation/engine';
import { RESERVATION_CLOSED_STATUSES, type Reservation } from '@/domain/reservation/schema';
import { RESOURCE_UTC_OFFSET } from '@/domain/reservation/time';
import type { Resource } from '@/domain/resource/schema';
import type { User } from '@/domain/user/schema';

/*
  회의(calendarEvents)와 회의실 예약(reservations)을 한 번에 저장한다 (spec 3.3).
  두 저장소를 묶는 트랜잭션이 없어서, 순서를 정하고 실패하면 앞 단계를 되돌린다.
  원칙: 예약을 먼저 잡고(충돌이면 회의도 안 건드림) 회의를 저장한다. 회의 저장이 실패하면
  잡은 예약을 되돌린다 — 예약이 남으면 실제 회의실이 계속 막히기 때문이다.
*/

export interface MeetingActors {
  calendar: CalendarEventActor;
  user: User;
  isAdmin?: boolean;
}

export interface MeetingSaveInput {
  /** 있으면 기존 회의 수정, 없으면 새 회의. */
  eventId?: string;
  draft: CalendarEventDraft;
  /** 고른 회의실 자원 id. null = 회의실 없음(직접 적은 장소만). */
  roomId: string | null;
  /** 예약 목적 — 비면 "회의". */
  purpose: string;
}

export const ROOM_ROLLBACK_MESSAGE = '회의실 예약은 남아 있습니다. 자원예약에서 취소해 주세요.';
/** 방을 바꿔 회의는 새 방으로 저장됐는데 이전 방 예약을 취소하지 못했을 때. */
export const OLD_ROOM_LEFT_MESSAGE = '이전 회의실 예약은 남아 있습니다. 자원예약에서 취소해 주세요.';

/** 잡아 둔 예약을 되돌리지 못했다 — 예약이 남아 회의실이 막혀 있다. */
export class RoomRollbackError extends Error {
  constructor(public readonly reservationId: string, public readonly cause?: unknown, message = ROOM_ROLLBACK_MESSAGE) {
    super(message);
    this.name = 'RoomRollbackError';
  }
}

const DEFAULT_PURPOSE = '회의';

/** 회의 날짜·시각(회의실 시간대 기준) → 예약 시각(ISO). */
export function toReservationWindow(date: string, startTime: string, endTime: string): { startAt: string; endAt: string } {
  return {
    startAt: new Date(`${date}T${startTime}:00${RESOURCE_UTC_OFFSET}`).toISOString(),
    endAt: new Date(`${date}T${endTime}:00${RESOURCE_UTC_OFFSET}`).toISOString(),
  };
}

/** 회의에서 바꾸거나 취소할 수 있는 예약인가 — 대기·확정이고 아직 시작 전. */
export function isReservationChangeable(row: Reservation, now: Date = new Date()): boolean {
  if (RESERVATION_CLOSED_STATUSES.includes(row.status)) return false;
  return (row.status === 'PENDING' || row.status === 'CONFIRMED') && new Date(row.startAt).getTime() > now.getTime();
}

/** 회의 장소로 고를 수 있는 회의실 — 사용 중인 ROOM 자원. */
export async function listMeetingRooms(): Promise<Resource[]> {
  return resourceRepo.list({ typeCode: 'ROOM', status: 'ACTIVE' });
}

/**
 * 방마다 그 시간에 비어 있는지. 충돌 판정은 자원예약 규칙(`assertNoConflict`, 앞뒤 여유시간 포함)을 그대로 쓴다.
 * `ignoreReservationId` = 수정 중인 회의가 이미 잡은 예약(자기 자신과는 겹쳐도 된다).
 */
export function roomAvailability(
  rooms: Resource[],
  reservations: Reservation[],
  window: { startAt: string; endAt: string },
  ignoreReservationId?: string,
): Map<string, boolean> {
  const result = new Map<string, boolean>();
  for (const room of rooms) {
    const others = reservations.filter((row) => row.resourceId === room.id && row.id !== ignoreReservationId);
    try {
      assertNoConflict(room, { ...window, quantity: 1 }, others);
      result.set(room.id, true);
    } catch {
      result.set(room.id, false);
    }
  }
  return result;
}

function meetingWindow(draft: CalendarEventDraft): { startAt: string; endAt: string } {
  if (draft.allDay || !draft.startTime || !draft.endTime) {
    throw new ReservationError('INVALID_INPUT', '종일 회의에는 회의실을 예약할 수 없습니다. 시간을 지정하세요.');
  }
  return toReservationWindow(draft.date, draft.startTime, draft.endTime);
}

const sameWindow = (row: Reservation, window: { startAt: string; endAt: string }) =>
  new Date(row.startAt).getTime() === new Date(window.startAt).getTime()
  && new Date(row.endAt).getTime() === new Date(window.endAt).getTime();

/** 새 예약 — 제목 = 회의 제목, 참석 인원 = 참석자 + 주최자. */
function createRoomReservation(actors: MeetingActors, roomId: string, input: MeetingSaveInput): Promise<Reservation> {
  const { draft } = input;
  const attendeeUserIds = [...new Set(draft.attendeeUserIds ?? [])].filter((id) => id !== actors.user.id);
  return reservationRepo.create(actors.user, {
    resourceId: roomId,
    requesterDeptId: actors.calendar.deptId ?? null,
    title: draft.title.trim(),
    purpose: input.purpose.trim() || DEFAULT_PURPOSE,
    ...meetingWindow(draft),
    quantity: 1,
    attendeeCount: attendeeUserIds.length + 1,
    attendeeUserIds,
  });
}

/** 회의 저장이 실패했을 때 방금 잡은 예약을 취소한다. 그마저 실패하면 RoomRollbackError. */
async function rollbackReservation(actors: MeetingActors, reservationId: string, cause: unknown): Promise<never> {
  try {
    await reservationRepo.cancel(actors.user, reservationId, '회의 저장 실패', actors.isAdmin);
  } catch (rollbackError) {
    console.error('회의실 예약 되돌리기 실패:', rollbackError);
    throw new RoomRollbackError(reservationId, cause);
  }
  throw cause;
}

/**
 * 회의 내용이 일정 규칙을 통과하는지 예약을 건드리기 전에 본다 — 잘못된 회의로 방을 잡거나,
 * 예약 시간을 옮긴 뒤 회의가 검증에 걸려 둘이 어긋나지 않게. 실제 저장 검증은 repo가 한 번 더 한다.
 * 새 회의(`current` 없음)는 저장 때 채워질 id·소유자·시각을 임시값으로 넣어 본다.
 */
function assertMeetingValid(actors: MeetingActors, current: CalendarEvent | null, draft: CalendarEventDraft): void {
  const now = new Date().toISOString();
  const base = current ?? { id: 'CAL-00000000-0000', ownerUserId: actors.calendar.userId, createdAt: now, updatedAt: now, reminded: false };
  const parsed = calendarEventSchema.safeParse({ ...base, ...draft });
  if (!parsed.success) {
    throw new CalendarEventError('INVALID_INPUT', parsed.error.issues[0]?.message || '입력값을 확인하세요.');
  }
}

async function createMeeting(actors: MeetingActors, input: MeetingSaveInput): Promise<CalendarEvent> {
  if (!input.roomId) {
    return calendarEventRepo.create(actors.calendar, { ...input.draft, reservationId: null });
  }
  assertMeetingValid(actors, null, input.draft);
  const reservation = await createRoomReservation(actors, input.roomId, input);
  try {
    return await calendarEventRepo.create(actors.calendar, {
      ...input.draft,
      location: reservation.resourceNameSnapshot,
      reservationId: reservation.id,
    });
  } catch (error) {
    return rollbackReservation(actors, reservation.id, error);
  }
}

async function updateMeeting(actors: MeetingActors, eventId: string, input: MeetingSaveInput): Promise<CalendarEvent> {
  const current = await calendarEventRepo.get(actors.calendar, eventId);
  if (!current || current.ownerUserId !== actors.calendar.userId) {
    throw new CalendarEventError('NOT_FOUND', '일정을 찾을 수 없거나 접근 권한이 없습니다.');
  }
  const { draft, roomId } = input;
  const linked = current.reservationId ? await reservationRepo.get(current.reservationId) : null;
  const changeable = linked ? isReservationChangeable(linked) : false;

  // 방 해제 — 바꿀 수 있는 예약이면 취소하고 연결을 끊는다. 지난·반려 예약은 그대로 둔다.
  if (!roomId) {
    assertMeetingValid(actors, current, { ...draft, reservationId: null });
    if (linked && changeable) {
      await reservationRepo.cancel(actors.user, linked.id, '회의실 해제', actors.isAdmin);
    }
    return calendarEventRepo.update(actors.calendar, eventId, { ...draft, reservationId: null });
  }

  // 같은 방, 살아 있는 예약 — 시간만 맞춘다(겹치면 회의도 저장하지 않음).
  if (linked && changeable && linked.resourceId === roomId) {
    const patch: CalendarEventDraft = { ...draft, location: linked.resourceNameSnapshot, reservationId: linked.id };
    assertMeetingValid(actors, current, patch);
    const window = meetingWindow(draft);
    if (sameWindow(linked, window)) {
      return calendarEventRepo.update(actors.calendar, eventId, patch);
    }
    const previous = { startAt: linked.startAt, endAt: linked.endAt };
    await reservationRepo.reschedule(actors.user, linked.id, window, actors.isAdmin);
    try {
      return await calendarEventRepo.update(actors.calendar, eventId, patch);
    } catch (error) {
      // 회의는 옛 시간 그대로라 예약 시간도 되돌린다. 못 되돌리면 새 시간에 방이 막혀 있다.
      try {
        await reservationRepo.reschedule(actors.user, linked.id, previous, actors.isAdmin);
      } catch (rollbackError) {
        console.error('회의실 예약 시간 되돌리기 실패:', rollbackError);
        throw new RoomRollbackError(linked.id, error);
      }
      throw error;
    }
  }

  /*
    새 예약이 필요한 경우 — 처음 고름·방 변경, 또는 연결 예약이 바꿀 수 없는 상태(반려·취소·지남)인데
    방을 고름(같은 방이라도 다시 신청). 새 예약 → 회의 저장 → 살아 있던 옛 예약 취소.
    닫힌 옛 예약은 건드리지 않는다.
  */
  assertMeetingValid(actors, current, { ...draft, reservationId: null });
  const reservation = await createRoomReservation(actors, roomId, input);
  let updated: CalendarEvent;
  try {
    updated = await calendarEventRepo.update(actors.calendar, eventId, {
      ...draft,
      location: reservation.resourceNameSnapshot,
      reservationId: reservation.id,
    });
  } catch (error) {
    return rollbackReservation(actors, reservation.id, error);
  }
  if (linked && changeable) {
    try {
      await reservationRepo.cancel(actors.user, linked.id, '회의실 변경', actors.isAdmin);
    } catch (error) {
      // 회의는 새 방으로 저장됐지만 옛 방 예약이 남았다.
      console.error('이전 회의실 예약 취소 실패:', error);
      throw new RoomRollbackError(linked.id, error, OLD_ROOM_LEFT_MESSAGE);
    }
  }
  return updated;
}

/** 회의 저장(새 회의·수정) + 연결된 회의실 예약 생성·시간 변경·취소. */
export async function saveMeeting(actors: MeetingActors, input: MeetingSaveInput): Promise<CalendarEvent> {
  return input.eventId ? updateMeeting(actors, input.eventId, input) : createMeeting(actors, input);
}

/** 회의 삭제 — 바꿀 수 있는 연결 예약은 먼저 취소한다(지난·반려 예약은 그대로). */
export async function removeMeeting(actors: MeetingActors, event: CalendarEvent): Promise<void> {
  const linked = event.reservationId ? await reservationRepo.get(event.reservationId) : null;
  if (linked && isReservationChangeable(linked)) {
    await reservationRepo.cancel(actors.user, linked.id, '회의 취소', actors.isAdmin);
  }
  await calendarEventRepo.remove(actors.calendar, event.id);
}
