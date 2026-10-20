import assert from 'node:assert/strict';
import test from 'node:test';
import {
  durationLabel,
  layoutColumns,
  moveRange,
  quickDefaultRange,
  rangeFromDrag,
  resizeEnd,
  toHHmm,
  toMinutes,
} from './timeGrid';

test('클릭 한 번 = 그 30분 칸', () => {
  assert.deepEqual(rangeFromDrag(605, 605), { start: 600, end: 630 });
});

test('위로 끌어도 같은 구간', () => {
  assert.deepEqual(rangeFromDrag(700, 610), { start: 600, end: 720 });
  assert.deepEqual(rangeFromDrag(610, 700), { start: 600, end: 720 });
});

test('맨 아래 칸을 끌어도 24시를 넘지 않는다', () => {
  assert.deepEqual(rangeFromDrag(1430, 1430), { start: 1410, end: 1440 });
  assert.deepEqual(rangeFromDrag(1440, 1440), { start: 1410, end: 1440 });
});

test('옮기기는 길이 유지·경계 안', () => {
  assert.deepEqual(moveRange({ start: 600, end: 690 }, 20), { start: 630, end: 720 });
  assert.deepEqual(moveRange({ start: 600, end: 690 }, 10), { start: 600, end: 690 });
  assert.deepEqual(moveRange({ start: 600, end: 690 }, 1000), { start: 1350, end: 1440 });
  assert.deepEqual(moveRange({ start: 600, end: 690 }, -900), { start: 0, end: 90 });
});

test('끝 늘리기는 최소 30분, 최대 24시', () => {
  assert.deepEqual(resizeEnd({ start: 600, end: 630 }, 590), { start: 600, end: 630 });
  assert.deepEqual(resizeEnd({ start: 1380, end: 1410 }, 1500), { start: 1380, end: 1440 });
  assert.deepEqual(resizeEnd({ start: 600, end: 630 }, 701), { start: 600, end: 720 });
});

test('시각 변환: 1440은 23:59로', () => {
  assert.equal(toHHmm(1440), '23:59');
  assert.equal(toHHmm(570), '09:30');
  assert.equal(toMinutes('09:30'), 570);
  assert.equal(toMinutes('00:00'), 0);
});

test('길이 표시', () => {
  assert.equal(durationLabel({ start: 0, end: 30 }), '30분');
  assert.equal(durationLabel({ start: 0, end: 60 }), '1시간');
  assert.equal(durationLabel({ start: 0, end: 90 }), '1시간 30분');
});

test('겹치는 블록은 옆으로 나눈다', () => {
  const out = layoutColumns([
    { key: 'a', start: 540, end: 600 },
    { key: 'b', start: 570, end: 630 },
    { key: 'c', start: 660, end: 720 },
  ]);
  const by = Object.fromEntries(out.map((b) => [b.key, b]));
  assert.equal(by.a.cols, 2);
  assert.equal(by.b.cols, 2);
  assert.notEqual(by.a.col, by.b.col);
  assert.equal(by.c.cols, 1);
  assert.equal(by.c.col, 0);
});

test('맞닿은 블록은 겹침이 아니다', () => {
  const out = layoutColumns([
    { key: 'a', start: 540, end: 600 },
    { key: 'b', start: 600, end: 660 },
  ]);
  assert.deepEqual(out.map((b) => [b.col, b.cols]), [[0, 1], [0, 1]]);
});

test('빠른 입력 기본값', () => {
  assert.deepEqual(quickDefaultRange(new Date(2026, 9, 21, 10, 7)), { start: 630, end: 660 });
  assert.deepEqual(quickDefaultRange(new Date(2026, 9, 21, 10, 0)), { start: 630, end: 660 });
  assert.deepEqual(quickDefaultRange(new Date(2026, 9, 21, 23, 40)), { start: 1410, end: 1440 });
  assert.deepEqual(quickDefaultRange(new Date(2026, 9, 21, 23, 30)), { start: 1410, end: 1440 });
});
