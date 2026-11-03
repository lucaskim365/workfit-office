import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarEventRepo, CalendarEventError, type CalendarEventActor } from '@/data/calendarEvent/calendarEvent.repo';
import { reservationRepo } from '@/data/reservation/reservation.repo';
import { resourceRepo } from '@/data/resource/resource.repo';
import { USER_SEED } from '@/data/seeds/user.seed';
import type { CalendarEventDraft } from '@/domain/calendarEvent/schema';
import { ReservationError } from '@/domain/reservation/engine';
import { RESOURCE_UTC_OFFSET, resourceDateKey } from '@/domain/reservation/time';
import type { Resource, ResourceDraft } from '@/domain/resource/schema';
import { userSchema, type User } from '@/domain/user/schema';
import {
  RoomRollbackError,
  removeMeeting,
  roomAvailability,
  saveMeeting,
  toReservationWindow,
  type MeetingActors,
} from './meetingWithRoom';

function user(id: string): User {
  const row = USER_SEED.find((item) => item.id === id);
  if (!row) throw new Error(`테스트 사용자를 찾을 수 없습니다: ${id}`);
  return userSchema.parse(row);
}

const host = user('U010');
const other = user('U012');
const roomManager = user('U009');
const calendarActor: CalendarEventActor = { userId: host.id, deptId: 'D230', active: true };
const actors: MeetingActors = { calendar: calendarActor, user: host };

/** 오늘(회의실 시간대 기준)부터 days일 뒤 날짜. */
function futureDate(days: number): string {
  const target = new Date(`${resourceDateKey(new Date())}T00:00:00${RESOURCE_UTC_OFFSET}`);
  target.setUTCDate(target.getUTCDate() + days);
  return resourceDateKey(target);
}

const roomDraft = (code: string, name: string, approvalMode: 'INSTANT' | 'APPROVAL'): ResourceDraft => ({
  code, name, typeCode: 'ROOM', bookingMode: 'TIME_SLOT', location: '본사', description: '',
  capacity: 10, totalQuantity: 1, unitCode: 'EA', managerUserId: 'U009', ownerDeptId: null, approvalMode,
  slotMinutes: 30, minDurationMinutes: 30, maxDurationMinutes: 480, bufferBeforeMinutes: 0, bufferAfterMinutes: 0,
  maxAdvanceDays: 60, cancelDeadlineMinutes: 30, availableFrom: '08:00', availableTo: '20:00', status: 'ACTIVE', imageUrl: null, notes: '',
});

let rooms: Promise<{ instant: Resource; approval: Resource; spare: Resource }> | null = null;
/** 테스트 전용 회의실 — 시드 회의실 설정에 기대지 않는다. */
function testRooms() {
  rooms ??= (async () => ({
    instant: await resourceRepo.save(roomManager, roomDraft('TEST-MTG-A', '테스트 즉시회의실', 'INSTANT'), undefined, true),
    approval: await resourceRepo.save(roomManager, roomDraft('TEST-MTG-B', '테스트 승인회의실', 'APPROVAL'), undefined, true),
    spare: await resourceRepo.save(roomManager, roomDraft('TEST-MTG-C', '테스트 예비회의실', 'INSTANT'), undefined, true),
  }))();
  return rooms;
}

const meeting = (date: string, over: Partial<CalendarEventDraft> = {}): CalendarEventDraft => ({
  title: '회의실 연동 회의',
  date,
  allDay: false,
  startTime: '10:00',
  endTime: '11:00',
  memo: '',
  visibility: 'COMPANY',
  eventType: 'MEETING',
  attendeeUserIds: ['U012'],
  deptId: null,
  projectId: null,
  ...over,
});

/** 일부러 실패를 넣는 테스트에서 오류 로그를 숨긴다. */
async function quietly<T>(work: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  try {
    return await work();
  } finally {
    console.error = original;
  }
}

const meetingsTitled = async (date: string, title: string) =>
  (await calendarEventRepo.list(calendarActor, { from: date, to: date })).filter((row) => row.title === title);

test('toReservationWindow: 회의실 시간대(+09:00) 기준 ISO', () => {
  assert.deepEqual(toReservationWindow('2026-11-02', '10:00', '11:30'), {
    startAt: '2026-11-02T01:00:00.000Z',
    endAt: '2026-11-02T02:30:00.000Z',
  });
});

test('방을 고르면 예약과 회의가 함께 생기고 연결된다', async () => {
  const { instant } = await testRooms();
  const date = futureDate(10);
  const event = await saveMeeting(actors, { draft: meeting(date), roomId: instant.id, purpose: '주간 공유' });
  assert.ok(event.reservationId);
  assert.equal(event.location, instant.name);
  const reservation = await reservationRepo.get(event.reservationId!);
  assert.equal(reservation?.resourceId, instant.id);
  assert.equal(reservation?.status, 'CONFIRMED');
  assert.equal(reservation?.title, '회의실 연동 회의');
  assert.equal(reservation?.purpose, '주간 공유');
  assert.deepEqual(reservation?.attendeeUserIds, ['U012']);
  assert.equal(reservation?.attendeeCount, 2);
  assert.deepEqual(
    { startAt: reservation?.startAt, endAt: reservation?.endAt },
    toReservationWindow(date, '10:00', '11:00'),
  );
});

test('목적이 비면 "회의"로 예약한다', async () => {
  const { instant } = await testRooms();
  const event = await saveMeeting(actors, { draft: meeting(futureDate(10), { startTime: '13:00', endTime: '14:00' }), roomId: instant.id, purpose: '  ' });
  assert.equal((await reservationRepo.get(event.reservationId!))?.purpose, '회의');
});

test('승인 필요 방은 예약이 PENDING', async () => {
  const { approval } = await testRooms();
  const event = await saveMeeting(actors, { draft: meeting(futureDate(11)), roomId: approval.id, purpose: '' });
  assert.equal((await reservationRepo.get(event.reservationId!))?.status, 'PENDING');
});

test('방 없이 저장하면 예약을 만들지 않는다', async () => {
  const event = await saveMeeting(actors, { draft: meeting(futureDate(11), { title: '방 없는 회의', location: '3층 라운지' }), roomId: null, purpose: '' });
  assert.equal(event.reservationId, null);
  assert.equal(event.location, '3층 라운지');
});

test('저장 직전 충돌이면 회의를 만들지 않는다', async () => {
  const { instant } = await testRooms();
  const date = futureDate(12);
  await reservationRepo.create(other, {
    resourceId: instant.id, requesterDeptId: null, title: '먼저 잡은 예약', purpose: '선점',
    ...toReservationWindow(date, '10:00', '11:00'), quantity: 1, attendeeCount: 2, attendeeUserIds: [],
  });
  await assert.rejects(
    () => saveMeeting(actors, { draft: meeting(date, { title: '늦게 잡은 회의' }), roomId: instant.id, purpose: '' }),
    (error) => error instanceof ReservationError && error.code === 'CONFLICT',
  );
  assert.equal((await meetingsTitled(date, '늦게 잡은 회의')).length, 0);
});

const windowFilter = (date: string, start: string, end: string) => {
  const window = toReservationWindow(date, start, end);
  return { from: window.startAt, to: window.endAt };
};

test('회의 내용이 잘못되면 방을 잡지 않는다', async () => {
  const { instant } = await testRooms();
  const date = futureDate(13);
  await assert.rejects(
    () => saveMeeting(actors, { draft: meeting(date, { title: '가'.repeat(101), startTime: '15:00', endTime: '16:00' }), roomId: instant.id, purpose: '' }),
    (error) => error instanceof CalendarEventError && error.code === 'INVALID_INPUT',
  );
  assert.equal((await reservationRepo.list({ resourceId: instant.id, ...windowFilter(date, '15:00', '16:00') })).length, 0);
});

test('회의 수정 내용이 잘못되면 예약 시간을 옮기지 않는다', async () => {
  const { instant } = await testRooms();
  const date = futureDate(13);
  const created = await saveMeeting(actors, { draft: meeting(date, { startTime: '17:00', endTime: '18:00' }), roomId: instant.id, purpose: '' });
  await assert.rejects(
    () => saveMeeting(actors, { eventId: created.id, draft: meeting(date, { title: '', startTime: '18:00', endTime: '19:00' }), roomId: instant.id, purpose: '' }),
    (error) => error instanceof CalendarEventError && error.code === 'INVALID_INPUT',
  );
  const reservation = await reservationRepo.get(created.reservationId!);
  assert.deepEqual({ startAt: reservation?.startAt, endAt: reservation?.endAt }, toReservationWindow(date, '17:00', '18:00'));
});

test('회의 생성 실패 시 예약 취소', async () => {
  const { instant } = await testRooms();
  const date = futureDate(13);
  const originalCreate = calendarEventRepo.create;
  try {
    calendarEventRepo.create = async () => { throw new Error('저장소 오류'); };
    await assert.rejects(() => saveMeeting(actors, { draft: meeting(date), roomId: instant.id, purpose: '' }), /저장소 오류/);
  } finally {
    calendarEventRepo.create = originalCreate;
  }
  const left = await reservationRepo.list({ resourceId: instant.id, ...((w) => ({ from: w.startAt, to: w.endAt }))(toReservationWindow(date, '10:00', '11:00')) });
  assert.equal(left.length, 1);
  assert.equal(left[0].status, 'CANCELLED');
  assert.equal(left[0].cancelReason, '회의 저장 실패');
});

test('되돌리기 실패 시 RoomRollbackError', async () => {
  const { instant } = await testRooms();
  const date = futureDate(14);
  const original = reservationRepo.cancel;
  const originalCreate = calendarEventRepo.create;
  try {
    reservationRepo.cancel = async () => { throw new Error('네트워크 오류'); };
    calendarEventRepo.create = async () => { throw new Error('저장소 오류'); };
    await assert.rejects(
      () => quietly(() => saveMeeting(actors, { draft: meeting(date), roomId: instant.id, purpose: '' })),
      (error) => error instanceof RoomRollbackError && error.message === '회의실 예약은 남아 있습니다. 자원예약에서 취소해 주세요.',
    );
  } finally {
    reservationRepo.cancel = original;
    calendarEventRepo.create = originalCreate;
  }
  const window = toReservationWindow(date, '10:00', '11:00');
  const left = await reservationRepo.list({ resourceId: instant.id, from: window.startAt, to: window.endAt });
  assert.equal(left.length, 1);
  assert.equal(left[0].status, 'CONFIRMED');
  await reservationRepo.cancel(host, left[0].id, '테스트 정리');
});

test('시간 변경은 예약도 reschedule', async () => {
  const { instant } = await testRooms();
  const date = futureDate(15);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: instant.id, purpose: '' });
  const updated = await saveMeeting(actors, {
    eventId: created.id, draft: meeting(date, { startTime: '14:00', endTime: '15:30' }), roomId: instant.id, purpose: '',
  });
  assert.equal(updated.reservationId, created.reservationId);
  assert.equal(updated.startTime, '14:00');
  const reservation = await reservationRepo.get(created.reservationId!);
  assert.deepEqual({ startAt: reservation?.startAt, endAt: reservation?.endAt }, toReservationWindow(date, '14:00', '15:30'));
  assert.equal(reservation?.status, 'CONFIRMED');
});

test('시간이 그대로면 예약은 손대지 않고 회의만 고친다', async () => {
  const { instant } = await testRooms();
  const date = futureDate(15);
  const created = await saveMeeting(actors, { draft: meeting(date, { startTime: '17:00', endTime: '18:00' }), roomId: instant.id, purpose: '' });
  const before = await reservationRepo.get(created.reservationId!);
  const updated = await saveMeeting(actors, {
    eventId: created.id, draft: meeting(date, { startTime: '17:00', endTime: '18:00', memo: '안건 추가' }), roomId: instant.id, purpose: '',
  });
  assert.equal(updated.memo, '안건 추가');
  assert.equal((await reservationRepo.get(created.reservationId!))?.version, before?.version);
});

test('시간 변경이 다른 예약과 겹치면 회의도 그대로', async () => {
  const { instant } = await testRooms();
  const date = futureDate(16);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: instant.id, purpose: '' });
  await reservationRepo.create(other, {
    resourceId: instant.id, requesterDeptId: null, title: '오후 예약', purpose: '선점',
    ...toReservationWindow(date, '14:00', '15:00'), quantity: 1, attendeeCount: 2, attendeeUserIds: [],
  });
  await assert.rejects(
    () => saveMeeting(actors, { eventId: created.id, draft: meeting(date, { startTime: '14:00', endTime: '15:00' }), roomId: instant.id, purpose: '' }),
    (error) => error instanceof ReservationError && error.code === 'CONFLICT',
  );
  const event = await calendarEventRepo.get(calendarActor, created.id);
  assert.equal(event?.startTime, '10:00');
  const reservation = await reservationRepo.get(created.reservationId!);
  assert.deepEqual({ startAt: reservation?.startAt, endAt: reservation?.endAt }, toReservationWindow(date, '10:00', '11:00'));
});

test('방 변경은 기존 예약 취소 + 새 예약', async () => {
  const { instant, spare } = await testRooms();
  const date = futureDate(17);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: instant.id, purpose: '' });
  const updated = await saveMeeting(actors, { eventId: created.id, draft: meeting(date), roomId: spare.id, purpose: '' });
  assert.notEqual(updated.reservationId, created.reservationId);
  assert.equal(updated.location, spare.name);
  const oldRow = await reservationRepo.get(created.reservationId!);
  assert.equal(oldRow?.status, 'CANCELLED');
  assert.equal(oldRow?.cancelReason, '회의실 변경');
  const newRow = await reservationRepo.get(updated.reservationId!);
  assert.equal(newRow?.resourceId, spare.id);
  assert.equal(newRow?.status, 'CONFIRMED');
});

test('방 변경 중 새 방이 차 있으면 기존 예약·회의 그대로', async () => {
  const { instant, spare } = await testRooms();
  const date = futureDate(18);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: instant.id, purpose: '' });
  await reservationRepo.create(other, {
    resourceId: spare.id, requesterDeptId: null, title: '예비실 선점', purpose: '선점',
    ...toReservationWindow(date, '10:00', '11:00'), quantity: 1, attendeeCount: 2, attendeeUserIds: [],
  });
  await assert.rejects(
    () => saveMeeting(actors, { eventId: created.id, draft: meeting(date), roomId: spare.id, purpose: '' }),
    (error) => error instanceof ReservationError && error.code === 'CONFLICT',
  );
  assert.equal((await reservationRepo.get(created.reservationId!))?.status, 'CONFIRMED');
  assert.equal((await calendarEventRepo.get(calendarActor, created.id))?.reservationId, created.reservationId);
});

test('방 해제는 예약 취소하고 연결을 끊는다', async () => {
  const { instant } = await testRooms();
  const date = futureDate(19);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: instant.id, purpose: '' });
  const updated = await saveMeeting(actors, { eventId: created.id, draft: meeting(date, { location: null }), roomId: null, purpose: '' });
  assert.equal(updated.reservationId, null);
  assert.equal(updated.location, null);
  assert.equal((await reservationRepo.get(created.reservationId!))?.status, 'CANCELLED');
});

test('삭제는 예약 취소', async () => {
  const { instant } = await testRooms();
  const date = futureDate(20);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: instant.id, purpose: '' });
  await removeMeeting(actors, created);
  const reservation = await reservationRepo.get(created.reservationId!);
  assert.equal(reservation?.status, 'CANCELLED');
  assert.equal(reservation?.cancelReason, '회의 취소');
  assert.equal(await calendarEventRepo.get(calendarActor, created.id), null);
});

test('반려된 예약은 건드리지 않고 회의만 고친다', async () => {
  const { approval } = await testRooms();
  const date = futureDate(21);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: approval.id, purpose: '' });
  await reservationRepo.reject(roomManager, created.reservationId!, '사용 불가');
  const updated = await saveMeeting(actors, {
    eventId: created.id, draft: meeting(date, { startTime: '15:00', endTime: '16:00' }), roomId: approval.id, purpose: '',
  });
  assert.equal(updated.startTime, '15:00');
  const reservation = await reservationRepo.get(created.reservationId!);
  assert.equal(reservation?.status, 'REJECTED');
  assert.deepEqual({ startAt: reservation?.startAt, endAt: reservation?.endAt }, toReservationWindow(date, '10:00', '11:00'));
});

test('반려된 예약은 같은 방을 그대로 두고 저장해도 새로 신청한다', async () => {
  const { approval } = await testRooms();
  const date = futureDate(24);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: approval.id, purpose: '' });
  await reservationRepo.reject(roomManager, created.reservationId!, '사용 불가');
  const updated = await saveMeeting(actors, { eventId: created.id, draft: meeting(date), roomId: approval.id, purpose: '' });
  assert.notEqual(updated.reservationId, created.reservationId);
  assert.equal(updated.location, approval.name);
  assert.equal((await reservationRepo.get(created.reservationId!))?.status, 'REJECTED');
  assert.equal((await reservationRepo.get(updated.reservationId!))?.status, 'PENDING');
});

test('방 변경 후 이전 예약 취소 실패는 이전 예약이 남았다고 알린다', async () => {
  const { instant, spare } = await testRooms();
  const date = futureDate(25);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: instant.id, purpose: '' });
  const original = reservationRepo.cancel;
  try {
    reservationRepo.cancel = async () => { throw new Error('네트워크 오류'); };
    await assert.rejects(
      () => quietly(() => saveMeeting(actors, { eventId: created.id, draft: meeting(date), roomId: spare.id, purpose: '' })),
      (error) => error instanceof RoomRollbackError
        && error.message === '이전 회의실 예약은 남아 있습니다. 자원예약에서 취소해 주세요.'
        && error.reservationId === created.reservationId,
    );
  } finally {
    reservationRepo.cancel = original;
  }
  assert.equal((await calendarEventRepo.get(calendarActor, created.id))?.location, spare.name);
  await reservationRepo.cancel(host, created.reservationId!, '테스트 정리');
});

test('반려된 회의에서 다른 방을 고르면 새 예약으로 연결을 바꾼다', async () => {
  const { approval, spare } = await testRooms();
  const date = futureDate(22);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: approval.id, purpose: '' });
  await reservationRepo.reject(roomManager, created.reservationId!, '사용 불가');
  const updated = await saveMeeting(actors, { eventId: created.id, draft: meeting(date), roomId: spare.id, purpose: '' });
  assert.notEqual(updated.reservationId, created.reservationId);
  assert.equal((await reservationRepo.get(created.reservationId!))?.status, 'REJECTED');
  assert.equal((await reservationRepo.get(updated.reservationId!))?.status, 'CONFIRMED');
});

test('roomAvailability: 겹치는 방 false, 자기 예약은 무시', async () => {
  const { instant, spare } = await testRooms();
  const date = futureDate(23);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: instant.id, purpose: '' });
  const reservations = await reservationRepo.list();
  const window = toReservationWindow(date, '10:30', '11:30');

  const busy = roomAvailability([instant, spare], reservations, window);
  assert.equal(busy.get(instant.id), false);
  assert.equal(busy.get(spare.id), true);

  const editing = roomAvailability([instant, spare], reservations, window, created.reservationId!);
  assert.equal(editing.get(instant.id), true);

  const after = roomAvailability([instant], reservations, toReservationWindow(date, '11:00', '12:00'));
  assert.equal(after.get(instant.id), true);
});

test('종일 회의에는 회의실을 잡지 않는다', async () => {
  const { instant } = await testRooms();
  await assert.rejects(
    () => saveMeeting(actors, { draft: meeting(futureDate(26), { title: '종일 회의', allDay: true, startTime: null, endTime: null }), roomId: instant.id, purpose: '' }),
    (error) => error instanceof ReservationError && error.code === 'INVALID_INPUT',
  );
  assert.equal((await meetingsTitled(futureDate(26), '종일 회의')).length, 0);
});

test('이미 시작한 예약은 같은 방으로 고쳐도 회의만 저장하고 연결 유지', async () => {
  const { instant } = await testRooms();
  const date = futureDate(27);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: instant.id, purpose: '' });
  const countBefore = (await reservationRepo.list({ resourceId: instant.id })).length;
  const originalGet = reservationRepo.get;
  try {
    // 예약 시작이 이미 지난 상태(확정, 진행 중)로 보이게 한다.
    reservationRepo.get = async (id) => {
      const row = await originalGet(id);
      return row && { ...row, startAt: new Date(Date.now() - 30 * 60_000).toISOString() };
    };
    const updated = await saveMeeting(actors, { eventId: created.id, draft: meeting(date, { memo: '진행 중 메모' }), roomId: instant.id, purpose: '' });
    assert.equal(updated.memo, '진행 중 메모');
    assert.equal(updated.reservationId, created.reservationId);
  } finally {
    reservationRepo.get = originalGet;
  }
  assert.equal((await reservationRepo.list({ resourceId: instant.id })).length, countBefore);
  assert.equal((await reservationRepo.get(created.reservationId!))?.status, 'CONFIRMED');
});

test('반려된 예약이라도 회의가 지난 시간이면 새로 신청하지 않는다', async () => {
  const { approval } = await testRooms();
  const date = futureDate(28);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: approval.id, purpose: '' });
  await reservationRepo.reject(roomManager, created.reservationId!, '사용 불가');
  const countBefore = (await reservationRepo.list({ resourceId: approval.id })).length;
  const past = futureDate(-1);
  const updated = await saveMeeting(actors, { eventId: created.id, draft: meeting(past, { memo: '지난 회의 기록' }), roomId: approval.id, purpose: '' });
  assert.equal(updated.memo, '지난 회의 기록');
  assert.equal(updated.reservationId, created.reservationId);
  assert.equal((await reservationRepo.list({ resourceId: approval.id })).length, countBefore);
  assert.equal((await reservationRepo.get(created.reservationId!))?.status, 'REJECTED');
});

test('회의 수정이 실패하면 옮긴 예약 시간을 되돌린다', async () => {
  const { instant } = await testRooms();
  const date = futureDate(29);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: instant.id, purpose: '' });
  const originalUpdate = calendarEventRepo.update;
  try {
    calendarEventRepo.update = async () => { throw new Error('저장소 오류'); };
    await assert.rejects(
      () => saveMeeting(actors, { eventId: created.id, draft: meeting(date, { startTime: '14:00', endTime: '15:00' }), roomId: instant.id, purpose: '' }),
      /저장소 오류/,
    );
  } finally {
    calendarEventRepo.update = originalUpdate;
  }
  const reservation = await reservationRepo.get(created.reservationId!);
  assert.deepEqual({ startAt: reservation?.startAt, endAt: reservation?.endAt }, toReservationWindow(date, '10:00', '11:00'));
  assert.equal(reservation?.status, 'CONFIRMED');
  assert.equal((await calendarEventRepo.get(calendarActor, created.id))?.startTime, '10:00');
});

test('바꿀 수 없는 예약이 걸린 회의 삭제는 회의만 지운다', async () => {
  const { approval } = await testRooms();
  const date = futureDate(30);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: approval.id, purpose: '' });
  await reservationRepo.reject(roomManager, created.reservationId!, '사용 불가');
  const original = reservationRepo.cancel;
  try {
    reservationRepo.cancel = async () => { throw new Error('취소하면 안 됨'); };
    await removeMeeting(actors, created);
  } finally {
    reservationRepo.cancel = original;
  }
  assert.equal(await calendarEventRepo.get(calendarActor, created.id), null);
  assert.equal((await reservationRepo.get(created.reservationId!))?.status, 'REJECTED');
});

test('방 해제 후 예약 취소 실패는 회의를 저장하고 이전 예약이 남았다고 알린다', async () => {
  const { instant } = await testRooms();
  const date = futureDate(31);
  const created = await saveMeeting(actors, { draft: meeting(date), roomId: instant.id, purpose: '' });
  const original = reservationRepo.cancel;
  try {
    reservationRepo.cancel = async () => { throw new Error('네트워크 오류'); };
    await assert.rejects(
      () => quietly(() => saveMeeting(actors, { eventId: created.id, draft: meeting(date, { location: null }), roomId: null, purpose: '' })),
      (error) => error instanceof RoomRollbackError && error.message === '이전 회의실 예약은 남아 있습니다. 자원예약에서 취소해 주세요.',
    );
  } finally {
    reservationRepo.cancel = original;
  }
  assert.equal((await calendarEventRepo.get(calendarActor, created.id))?.reservationId, null);
  await reservationRepo.cancel(host, created.reservationId!, '테스트 정리');
});
