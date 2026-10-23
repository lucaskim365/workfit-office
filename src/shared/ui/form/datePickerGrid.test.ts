import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthGrid, dayTone, isDateSelectable, shiftMonth } from './datePickerGrid';

test('buildMonthGrid — 일요일부터 6주 42칸, 앞뒤 달 날짜 포함', () => {
  const cells = buildMonthGrid(2026, 10); // 2026-10-01 = 목요일
  assert.equal(cells.length, 42);
  assert.deepEqual(cells[0], { date: '2026-09-27', day: 27, weekday: 0, inMonth: false });
  assert.deepEqual(cells[4], { date: '2026-10-01', day: 1, weekday: 4, inMonth: true });
  assert.deepEqual(cells[34], { date: '2026-10-31', day: 31, weekday: 6, inMonth: true });
  assert.equal(cells[41].date, '2026-11-07');
});

test('dayTone — 공휴일·일요일 빨강, 토요일 파랑 (공휴일이 토요일이어도 빨강)', () => {
  const holidays = new Map([['2026-10-03', '개천절'], ['2026-10-09', '한글날']]);
  assert.equal(dayTone('2026-10-03', 6, holidays), 'holiday'); // 토요일 개천절
  assert.equal(dayTone('2026-10-09', 5, holidays), 'holiday');
  assert.equal(dayTone('2026-10-04', 0, holidays), 'sun');
  assert.equal(dayTone('2026-10-10', 6, holidays), 'sat');
  assert.equal(dayTone('2026-10-12', 1, holidays), 'normal');
});

test('isDateSelectable — min·max 범위 (비어 있으면 제한 없음)', () => {
  assert.equal(isDateSelectable('2026-10-10', '2026-10-10', '2026-10-20'), true);
  assert.equal(isDateSelectable('2026-10-09', '2026-10-10', undefined), false);
  assert.equal(isDateSelectable('2026-10-21', '', '2026-10-20'), false);
  assert.equal(isDateSelectable('2026-10-21', undefined, undefined), true);
});

test('shiftMonth — 해 넘김', () => {
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth(2026, 5, -1), { year: 2026, month: 4 });
});
