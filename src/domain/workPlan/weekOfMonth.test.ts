import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekOfMonth } from './weekOfMonth';

// 업무계획 월간표와 같은 기준 — 월요일 시작 주, 그 달 1일이 든 주가 1주차
test('weekOfMonth — 월요일 시작 주차 (2026-10-01 목요일)', () => {
  assert.deepEqual(weekOfMonth('2026-10-01'), { month: 10, week: 1 });
  assert.deepEqual(weekOfMonth('2026-10-04'), { month: 10, week: 1 }); // 일요일까지 1주차
  assert.deepEqual(weekOfMonth('2026-10-05'), { month: 10, week: 2 });
  assert.deepEqual(weekOfMonth('2026-10-20'), { month: 10, week: 4 });
  assert.deepEqual(weekOfMonth('2026-10-31'), { month: 10, week: 5 });
});

test('weekOfMonth — 1일이 월요일·일요일인 달', () => {
  assert.deepEqual(weekOfMonth('2026-06-01'), { month: 6, week: 1 }); // 월요일
  assert.deepEqual(weekOfMonth('2026-06-08'), { month: 6, week: 2 });
  assert.deepEqual(weekOfMonth('2026-11-01'), { month: 11, week: 1 }); // 일요일
  assert.deepEqual(weekOfMonth('2026-11-02'), { month: 11, week: 2 });
});

test('weekOfMonth — 잘못된 날짜는 null', () => {
  assert.equal(weekOfMonth(''), null);
  assert.equal(weekOfMonth('2026-13-01'), null);
});
