import assert from 'node:assert/strict';
import test from 'node:test';
import { bucketOf, firstWeekday, monthDates, shiftMonth, todayKst } from './dashboard';

test('근태 판정을 4분류로 묶는다', () => {
  assert.equal(bucketOf('normal'), 'work');
  assert.equal(bucketOf('outside'), 'work');
  assert.equal(bucketOf('trip'), 'work');
  assert.equal(bucketOf('late'), 'late');
  assert.equal(bucketOf('leave'), 'leave');
  assert.equal(bucketOf('off'), 'pending');
  assert.equal(bucketOf('absent'), 'pending');
  assert.equal(bucketOf('unknown'), 'pending');
});

test('한국 시간 오늘 — UTC 15시는 다음 날', () => {
  assert.equal(todayKst(new Date('2026-11-09T15:30:00Z')), '2026-11-10');
  assert.equal(todayKst(new Date('2026-11-09T14:59:00Z')), '2026-11-09');
});

test('달 날짜·첫 요일·달 이동', () => {
  assert.equal(monthDates('2026-02').length, 28);
  assert.equal(monthDates('2026-11')[29], '2026-11-30');
  assert.equal(firstWeekday('2026-11'), 0); // 2026-11-01 일요일
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});

import { donutSlices, minutesOf, nowPercent, timelineSpan } from './dashboard';

test('타임라인 자리 — 08~20시 축', () => {
  assert.equal(minutesOf('09:30'), 570);
  assert.equal(minutesOf(null), null);
  assert.deepEqual(timelineSpan('08:00', '20:00'), { left: 0, width: 100 });
  const near = (a: { left: number; width: number } | null, left: number, width: number) =>
    assert.ok(a && Math.abs(a.left - left) < 1e-9 && Math.abs(a.width - width) < 1e-9, JSON.stringify(a));
  near(timelineSpan('14:00', null), 50, 100 / 12);
  near(timelineSpan('07:00', '09:00'), 0, 100 / 12);
  assert.equal(timelineSpan('21:00', '22:00'), null);
  assert.equal(timelineSpan(null, null), null);
});

test('지금 시각 — 한국 시간 기준', () => {
  assert.equal(nowPercent(new Date('2026-11-10T05:00:00Z')), 50); // 14:00 KST
  assert.equal(nowPercent(new Date('2026-11-10T13:00:00Z')), null); // 22:00 KST
});

test('도넛 조각 — 0 은 빼고 누적', () => {
  const s = donutSlices([{ key: 'a', value: 1 }, { key: 'b', value: 0 }, { key: 'c', value: 3 }]);
  assert.deepEqual(s.map((x) => [x.key, x.from, x.to]), [['a', 0, 0.25], ['c', 0.25, 1]]);
  assert.deepEqual(donutSlices([{ key: 'a', value: 0 }]), []);
});

import { moveSlot, nextSize, normalizeLayout, packLanes } from './dashboard';

test('겹치는 일정은 다음 칸으로', () => {
  const r = packLanes([
    { id: 'a', start: '10:00', end: '11:00' },
    { id: 'b', start: '10:30', end: '12:00' },
    { id: 'c', start: '11:00', end: '11:30' },
    { id: 'd', start: null, end: null },
  ]);
  assert.equal(r.count, 2);
  assert.deepEqual(r.lanes.map((x) => [x.item.id, x.lane]), [['a', 0], ['b', 1], ['c', 0]]);
  assert.equal(packLanes([]).count, 0);
});

test('위젯 배치 정리·이동·폭', () => {
  const known = ['a', 'b', 'c'] as const;
  const fb = [{ id: 'a' as const, size: 12 as const }];
  assert.deepEqual(normalizeLayout(null, known, fb), fb);
  assert.deepEqual(normalizeLayout([{ id: 'x', size: 4 }], known, fb), fb);
  assert.deepEqual(normalizeLayout([{ id: 'b', size: 5 }, { id: 'b', size: 4 }, { id: 'c', size: 8 }], known, fb), [{ id: 'b', size: 6 }, { id: 'c', size: 8 }]);
  assert.deepEqual(moveSlot(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(moveSlot(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  assert.equal(nextSize(12), 4);
  assert.equal(nextSize(4), 6);
});

import { insertSlot, snapSize } from './dashboard';

test('끌어 늘린 폭 맞추기·위젯 끼우기', () => {
  assert.equal(snapSize(3), 4);
  assert.equal(snapSize(5.2), 6);
  assert.equal(snapSize(9.9), 8);
  assert.equal(snapSize(10.1), 12);
  assert.equal(snapSize(3, [8, 12]), 8);
  const list = [{ id: 'a', size: 4 as const }];
  assert.deepEqual(insertSlot(list, { id: 'b', size: 6 }, 0).map((s) => s.id), ['b', 'a']);
  assert.equal(insertSlot(list, { id: 'a', size: 6 }, 0), list);
});

import { rowsFor, rowsHeight, snapRows } from './dashboard';

test('모눈 칸 — 높이는 칸 수로, 최소 칸 수 이상', () => {
  assert.equal(rowsHeight(1), 48);
  assert.equal(rowsHeight(4), 240);
  assert.equal(rowsFor(240), 4);
  assert.equal(rowsFor(241), 5);
  assert.equal(snapRows(250), 4);
  assert.equal(snapRows(10, 3), 3);
  assert.equal(snapRows(99999), 40);
  const known = ['a'] as const;
  assert.deepEqual(normalizeLayout([{ id: 'a', size: 4, rows: 5 }], known, []), [{ id: 'a', size: 4, rows: 5 }]);
  assert.deepEqual(normalizeLayout([{ id: 'a', size: 4, rows: 2.5 }], known, []), [{ id: 'a', size: 4 }]);
  assert.deepEqual(normalizeLayout([{ id: 'a', size: 4, h: 300 }], known, []), [{ id: 'a', size: 4 }]);
});

import { hoursText, timeAgo, weekDates } from './dashboard';

test('주간 날짜·지난 시간·시간 글자', () => {
  assert.deepEqual(weekDates('2026-11-10'), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  assert.equal(weekDates('2026-11-01')[0], '2026-10-26'); // 일요일은 그 주 마지막 날
  const now = new Date('2026-11-10T05:00:00Z');
  assert.equal(timeAgo('2026-11-10T04:59:30Z', now), '방금');
  assert.equal(timeAgo('2026-11-10T04:30:00Z', now), '30분 전');
  assert.equal(timeAgo('2026-11-10T01:00:00Z', now), '4시간 전');
  assert.equal(timeAgo('2026-11-08T05:00:00Z', now), '2일 전');
  assert.equal(timeAgo(null, now), '');
  assert.equal(hoursText(125), '2시간 5분');
  assert.equal(hoursText(120), '2시간');
  assert.equal(hoursText(40), '40분');
});
