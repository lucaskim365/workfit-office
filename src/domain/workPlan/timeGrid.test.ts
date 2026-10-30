import assert from 'node:assert/strict';
import test from 'node:test';
import {
  durationLabel,
  endTimeOptions,
  hourBlockOf,
  startTimeOptions,
  layoutColumns,
  parseTimeInput,
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

test('시작 시각 목록 — 30분 간격 00:00~23:30, 칸에 없는 지금 값은 끼워 넣는다', () => {
  const list = startTimeOptions(null);
  assert.equal(list.length, 48);
  assert.deepEqual(list.slice(0, 2), [0, 30]);
  assert.equal(list.at(-1), 1410);
  const odd = startTimeOptions(555); // 09:15
  assert.equal(odd.length, 49);
  assert.deepEqual(odd.slice(18, 21), [540, 555, 570]);
});

test('종료 시각 목록 — 시작 뒤 30분 간격(24:00까지)과 길이, 칸에 없는 지금 값도 포함', () => {
  const list = endTimeOptions(1380, null); // 23:00 시작
  assert.deepEqual(list.map((o) => o.minute), [1410, 1440]);
  assert.deepEqual(list.map((o) => o.label), ['23:30 (30분)', '24:00 (1시간)']);
  const odd = endTimeOptions(600, 645); // 10:00 시작, 10:45 끝
  assert.deepEqual(odd.slice(0, 3).map((o) => o.label), ['10:30 (30분)', '10:45 (45분)', '11:00 (1시간)']);
  // 시작이 30분 경계가 아니어도 다음 경계부터
  assert.equal(endTimeOptions(555, null)[0].minute, 570);
});

test('현재 시간대 — 그 시각이 속한 1시간 칸', () => {
  assert.deepEqual(hourBlockOf(new Date(2026, 9, 30, 10, 42)), { start: 600, end: 660 });
  assert.deepEqual(hourBlockOf(new Date(2026, 9, 30, 23, 59)), { start: 1380, end: 1440 });
});

test('시각 직접 입력 — 여러 표기를 분으로', () => {
  const cases: Array<[string, number | null]> = [
    ['9:30', 570],
    ['09:30', 570],
    ['930', 570],
    ['0930', 570],
    ['1430', 870],
    ['14', 840],
    ['9', 540],
    ['9시', 540],
    ['9시 30분', 570],
    ['9시반', 570],
    ['오전 9시', 540],
    ['오후 2시', 840],
    ['오후2:30', 870],
    ['2pm', 840],
    ['9:30am', 570],
    ['12pm', 720],
    ['12am', 0],
    ['오전 12시', 0],
    ['정오', 720],
    ['24:00', 1440],
    // 오전·오후 없이 1~7시 = 오후(근무시간 기준), 앞에 0을 붙이면 그대로
    ['2시', 840],
    ['2', 840],
    ['2:30', 870],
    ['02:00', 120],
    ['8', 480],
    // 5분 단위로 반올림
    ['9:32', 570],
    ['9:33', 575],
    // 못 읽는 값
    ['', null],
    ['abc', null],
    ['25', null],
    ['9:75', null],
    ['24:30', null],
  ];
  for (const [input, expected] of cases) assert.equal(parseTimeInput(input), expected, input);
});
