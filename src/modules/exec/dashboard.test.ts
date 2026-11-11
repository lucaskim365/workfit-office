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

import { arrange, firstFit, normalizeLayout, overlaps, packLanes } from './dashboard';

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

test('저장된 배치 정리 — 모르는 위젯·중복 버림, 잘못된 폭은 6칸, 자리는 정수만', () => {
  const known = ['a', 'b', 'c'] as const;
  const fb = [{ id: 'a' as const, size: 12 }];
  assert.deepEqual(normalizeLayout(null, known, fb), fb);
  assert.deepEqual(normalizeLayout([{ id: 'x', size: 4 }], known, fb), fb);
  assert.deepEqual(normalizeLayout([{ id: 'b', size: 13 }, { id: 'b', size: 4 }, { id: 'c', size: 5 }], known, fb), [{ id: 'b', size: 6 }, { id: 'c', size: 5 }]);
  assert.deepEqual(normalizeLayout([{ id: 'a', size: 4, x: 3, y: 2 }], known, fb), [{ id: 'a', size: 4, x: 3, y: 2 }]);
  assert.deepEqual(normalizeLayout([{ id: 'a', size: 4, x: 1.5, y: 2 }], known, fb), [{ id: 'a', size: 4 }]);
});

test('자리 잡기 — 빈자리 채우기, 겹치면 아래로 밀기, 빈칸은 그대로', () => {
  // 자리 없는 위젯은 위에서부터 빈자리에
  const a = arrange([{ id: 'a', w: 12, h: 2 }, { id: 'b', w: 8, h: 3 }, { id: 'c', w: 4, h: 2 }, { id: 'd', w: 4, h: 2 }]);
  assert.deepEqual(a.get('b'), { x: 0, y: 2, w: 8, h: 3 });
  assert.deepEqual(a.get('c'), { x: 8, y: 2, w: 4, h: 2 });
  assert.deepEqual(a.get('d'), { x: 8, y: 4, w: 4, h: 2 });
  // 빈 곳에 두면 왼쪽 위로 당겨 붙는다
  assert.deepEqual(arrange([{ id: 'a', w: 4, h: 2, x: 6, y: 5 }]).get('a'), { x: 0, y: 0, w: 4, h: 2 });
  // 옮긴 위젯이 놓은 칸의 순서를 차지하고, 원래 있던 위젯은 그 뒤로
  const m = arrange([{ id: 'a', w: 6, h: 3, x: 0, y: 0 }, { id: 'b', w: 6, h: 2, x: 0, y: 0 }], 'b');
  assert.deepEqual(m.get('b'), { x: 0, y: 0, w: 6, h: 2 });
  assert.deepEqual(m.get('a'), { x: 6, y: 0, w: 6, h: 3 });
  // 빈틈없이 — 넓은 위젯이 못 들어가는 빈칸에는 뒤의 작은 위젯이 들어간다
  const d = arrange([
    { id: 'half', w: 6, h: 4, x: 0, y: 0 },
    { id: 'wide', w: 12, h: 5, x: 0, y: 4 },
    { id: 'small', w: 6, h: 3, x: 0, y: 9 },
  ]);
  assert.deepEqual(d.get('small'), { x: 6, y: 0, w: 6, h: 3 });
  assert.deepEqual(d.get('wide'), { x: 0, y: 4, w: 12, h: 5 });
  // 빈칸은 높이가 다를 때만 — 짧은 위젯 아래 빈칸은 옆의 긴 위젯 때문에 넓은 위젯이 못 들어가서 남는다
  const g = arrange([
    { id: 'tall', w: 8, h: 6, x: 0, y: 0 },
    { id: 'short', w: 4, h: 2, x: 8, y: 3 },
    { id: 'wide', w: 12, h: 2, x: 0, y: 9 },
  ]);
  assert.deepEqual(g.get('short'), { x: 8, y: 0, w: 4, h: 2 });
  assert.deepEqual(g.get('wide'), { x: 0, y: 6, w: 12, h: 2 });
  assert.deepEqual(firstFit([{ x: 0, y: 0, w: 12, h: 1 }], 4, 1), { x: 0, y: 1 });
  assert.equal(overlaps({ x: 0, y: 0, w: 4, h: 2 }, { x: 4, y: 0, w: 4, h: 2 }), false);
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

import { mobilePath } from './dashboard';

test('위젯 링크 → 모바일 화면 주소', () => {
  assert.equal(mobilePath('/gw/approval?doc=AB%2F1'), '/m/approval/AB%2F1');
  assert.equal(mobilePath('/gw/approval?box=대기'), '/m/approval');
  assert.equal(mobilePath('/gw/board?board=notice&postId=p1'), '/m/board?board=notice&postId=p1');
  assert.equal(mobilePath('/gw/board'), '/m/board');
  assert.equal(mobilePath('/gw/leave'), '/m/commute');
  assert.equal(mobilePath('/gw/work-plan'), '/m/task');
  assert.equal(mobilePath('/gw/unknown'), '/m');
});

import { tierOf } from './dashboard';

test('위젯 크기 단계 — 칸 수는 가장 가까운 소·중·대로', () => {
  assert.deepEqual([1, 4, 6, 7, 8, 9, 10, 11, 12].map(tierOf), ['S', 'S', 'S', 'S', 'M', 'M', 'M', 'L', 'L']);
});
