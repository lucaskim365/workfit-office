import assert from 'node:assert/strict';
import test from 'node:test';
import { dayLabel, emptyMealTicketDay, monthCsv, monthDates, shiftMonth, summarizeMonth, type MealTicketDay } from './engine';

const day = (date: string, stockIn: number, recipients: string[], memo?: string): MealTicketDay => ({ ...emptyMealTicketDay(date), stockIn, recipients, memo });

test('한 달 날짜와 요일 표기', () => {
  assert.equal(monthDates('2026-02').length, 28);
  assert.equal(monthDates('2026-10').at(-1), '2026-10-31');
  assert.equal(dayLabel('2026-10-27'), '10/27(화)');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});

test('남은 식권은 입고 합계 − 받은 사람 수 합계이고 다음 달로 이월된다', () => {
  const days = [day('2026-09-30', 300, ['A', 'B']), day('2026-10-01', 0, ['A']), day('2026-10-03', 100, ['A', 'B', 'C'])];
  const { opening, rows } = summarizeMonth(days, monthDates('2026-10'));
  assert.equal(opening, 298);
  assert.deepEqual(rows[0], { date: '2026-10-01', stockIn: 0, issued: 1, remaining: 297 });
  assert.deepEqual(rows[1], { date: '2026-10-02', stockIn: 0, issued: 0, remaining: 297 });
  assert.deepEqual(rows[2], { date: '2026-10-03', stockIn: 100, issued: 3, remaining: 394 });
  assert.equal(rows.at(-1)!.remaining, 394);
});

test('CSV — 받은 칸 O, 사람별 합계, 입고·발행·남은 식권·메모 행, 쉼표는 따옴표로', () => {
  const days = [day('2026-02-01', 10, ['A']), day('2026-02-02', 0, ['A', 'B'], '분실 1, 반납 0')];
  const csv = monthCsv(days, monthDates('2026-02').slice(0, 2), [
    { id: 'A', name: '가', dept: '개발팀' },
    { id: 'B', name: '나', dept: '영업팀' },
  ]);
  assert.ok(csv.startsWith('﻿'));
  const lines = csv.slice(1).split('\r\n');
  assert.deepEqual(lines, [
    '이름,부서,2/1(일),2/2(월),합계',
    '가,개발팀,O,O,2',
    '나,영업팀,,O,1',
    '입고,전월 이월 0,10,,10',
    '발행,,1,2,3',
    '남은 식권,,9,7,7',
    '메모,,,"분실 1, 반납 0",',
  ]);
});
