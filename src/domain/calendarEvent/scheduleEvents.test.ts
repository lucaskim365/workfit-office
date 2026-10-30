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
  // 업무계획과 같이 제목(목적)만 — 행선지는 상세에서
  assert.equal(scheduleEvents[0].title, '[출장] 박광래 과장 · 현장 점검');
  assert.equal(scheduleEvents[0].eventType, 'OUTSIDE');
  assert.equal(outsideViewByEventId.get(scheduleEvents[0].id)?.self?.id, 'OW-20261030-0001');
});

test('퇴사자의 외근·출장은 뺀다', () => {
  const { scheduleEvents } = buildScheduleEvents([], [work('OW-20261030-0002', 'U099')], new Map(), new Set());
  assert.equal(scheduleEvents.length, 0);
});

test('제목(목적)이 없으면 이름만, 여러 줄이면 첫 줄만', () => {
  const userMap = new Map([['U010', { name: '박광래', position: '과장' }]]);
  const noTitle = { ...work('OW-20261030-0003', 'U010'), purpose: '' };
  const multi = { ...work('OW-20261030-0004', 'U010'), purpose: '\n고객 미팅\n세부 안건', memo: '준비물' };
  const { scheduleEvents } = buildScheduleEvents([], [noTitle, multi], userMap, new Set(['U010']));
  assert.equal(scheduleEvents[0].title, '[출장] 박광래 과장');
  const multiEvent = scheduleEvents.find((e) => e.id.includes('0004'));
  assert.equal(multiEvent?.title, '[출장] 박광래 과장 · 고객 미팅');
  // 일정 메모 = 등록한 메모(제목과 겹치지 않게)
  assert.equal(multiEvent?.memo, '준비물');
});
