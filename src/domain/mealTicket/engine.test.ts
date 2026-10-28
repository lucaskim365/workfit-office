import assert from 'node:assert/strict';
import test from 'node:test';
import { dayLabel, emptyMealTicketDay, monthCsv, monthDates, remainingAsOf, shiftMonth, summarizeMonth, type MealTicketDay } from './engine';

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
  const csv = monthCsv(days, monthDates('2026-02').slice(0, 3), [
    { id: 'A', name: '가', dept: '개발팀' },
    { id: 'B', name: '나', dept: '영업팀' },
  ], '2026-02-28');
  assert.ok(csv.startsWith('﻿'));
  const lines = csv.slice(1).split('\r\n');
  assert.deepEqual(lines, [
    '이름,부서,2/1(일),2/2(월),2/3(화),합계',
    '가,개발팀,O,O,,2',
    '나,영업팀,,O,,1',
    '입고,전월 이월 0,10,,,10',
    '발행,,1,2,,3',
    // 입고·발행이 없는 날(2/3)은 화면처럼 비운다
    '남은 식권,,9,7,,7',
    '메모,,,"분실 1, 반납 0",,',
  ]);
});

test('Shift 범위 — 두 칸 사이 사각형을 날짜별로, 거꾸로 골라도 같다', async () => {
  const { rangeCells, applyRecipients } = await import('./engine');
  const people = ['A', 'B', 'C', 'D'];
  const dates = ['2026-10-01', '2026-10-02', '2026-10-03'];
  const r = rangeCells(people, dates, { userId: 'C', date: '2026-10-03' }, { userId: 'B', date: '2026-10-02' });
  assert.deepEqual([...r], [['2026-10-02', ['B', 'C']], ['2026-10-03', ['B', 'C']]]);
  // 목록에 없는 사람(검색으로 걸러진 경우)은 범위를 만들지 않는다
  assert.equal(rangeCells(people, dates, { userId: 'Z', date: '2026-10-01' }, { userId: 'A', date: '2026-10-01' }).size, 0);

  assert.deepEqual(applyRecipients(['A', 'B'], ['B', 'C', 'C'], true), ['A', 'B', 'C']);
  assert.deepEqual(applyRecipients(['A', 'B', 'C'], ['A', 'C'], false), ['B']);
});

test('합계 칸 남은 수 — 오늘까지, 아직 오지 않은 달은 이월분', () => {
  const days = [day('2026-02-01', 10, ['A']), day('2026-02-03', 5, [])];
  const { opening, rows } = summarizeMonth(days, monthDates('2026-02').slice(0, 3));
  assert.equal(remainingAsOf(opening, rows, '2026-02-02'), 9);
  assert.equal(remainingAsOf(opening, rows, '2026-03-01'), 14);
  assert.equal(remainingAsOf(opening, rows, '2026-01-31'), opening);
});
