import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderDayItems } from './dashboard';

const it = (key: string, start: string | null, end: string | null, allDay = false) => ({ key, start, end, allDay });

test('오늘 일정 순서 — 종일 맨 위, 시작 시각 순(외근·출장 구분 없음), 시간 미정 맨 아래', () => {
  const list = [
    it('미정', null, null),
    it('외근', '13:00', '17:00'),
    it('업무9', '09:00', '10:00'),
    it('종일', null, null, true),
    it('회의9짧음', '09:00', '09:30'),
    it('끝없음', '09:00', null),
  ];
  assert.deepEqual(orderDayItems(list).map((x) => x.key), ['종일', '회의9짧음', '업무9', '끝없음', '외근', '미정']);
});
