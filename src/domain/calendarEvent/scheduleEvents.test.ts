import assert from 'node:assert/strict';
import test from 'node:test';
import { outsideWorkSchema } from '@/domain/outsideWork/schema';
import { buildScheduleEvents } from './scheduleEvents';

const now = new Date().toISOString();
const work = (id: string, ownerUserId: string) => outsideWorkSchema.parse({
  id, ownerUserId, category: 'TRIP', subType: '국내출장',
  startDate: '2026-10-30', endDate: '2026-11-01', allDay: true, startTime: null, endTime: null,
  destination: '부산', purpose: '현장 점검', createdAt: now, updatedAt: now,
});

test('직접 등록 출장은 날짜마다 펼치고 상세로 연결된다', () => {
  const userMap = new Map([['U010', { name: '박광래', position: '과장' }]]);
  const { scheduleEvents, outsideViewByEventId } = buildScheduleEvents(
    [], [work('OW-20261030-0001', 'U010')], userMap, new Set(['U010']),
  );
  assert.deepEqual(scheduleEvents.map((e) => e.date), ['2026-10-30', '2026-10-31', '2026-11-01']);
  assert.equal(scheduleEvents[0].title, '[출장] 박광래 과장 (부산)');
  assert.equal(scheduleEvents[0].eventType, 'OUTSIDE');
  assert.equal(outsideViewByEventId.get(scheduleEvents[0].id)?.self?.id, 'OW-20261030-0001');
});

test('퇴사자의 외근·출장은 뺀다', () => {
  const { scheduleEvents } = buildScheduleEvents([], [work('OW-20261030-0002', 'U099')], new Map(), new Set());
  assert.equal(scheduleEvents.length, 0);
});
