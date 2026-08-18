import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCalendarMonth, calendarToday, isValidCalendarDate, moveCalendarMonth } from './calendarDate';
import { calendarEventSchema } from './schema';

const baseEvent = {
  id: 'CAL-20260812-0001',
  ownerUserId: 'U011',
  title: '개인 일정',
  date: '2026-08-12',
  allDay: true,
  startTime: null,
  endTime: null,
  memo: '',
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
};

test('실제 날짜와 서울 기준 오늘을 계산한다', () => {
  assert.equal(isValidCalendarDate('2024-02-29'), true);
  assert.equal(isValidCalendarDate('2026-02-29'), false);
  assert.equal(calendarToday(new Date('2026-08-11T15:30:00.000Z')), '2026-08-12');
});

test('월요일부터 6주 월간 달력을 만든다', () => {
  const cells = buildCalendarMonth('2026-08');
  assert.equal(cells.length, 42);
  assert.equal(cells[0].date, '2026-07-27');
  assert.equal(cells[41].date, '2026-09-06');
  assert.equal(cells.filter((cell) => cell.inCurrentMonth).length, 31);
});

test('월말과 연말을 넘어 달을 이동한다', () => {
  assert.equal(moveCalendarMonth('2026-12', 1), '2027-01');
  assert.equal(moveCalendarMonth('2026-01', -1), '2025-12');
});

test('종일 일정과 시간 일정 불변식을 검증한다', () => {
  assert.equal(calendarEventSchema.safeParse(baseEvent).success, true);
  assert.equal(calendarEventSchema.safeParse({ ...baseEvent, allDay: false, startTime: '10:00', endTime: '09:00' }).success, false);
  assert.equal(calendarEventSchema.safeParse({ ...baseEvent, date: '2026-02-30' }).success, false);
  assert.equal(calendarEventSchema.safeParse({ ...baseEvent, startTime: '10:00' }).success, false);
});
