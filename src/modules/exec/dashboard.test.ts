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
