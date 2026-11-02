import assert from 'node:assert/strict';
import { movedDraft } from './item';
import test from 'node:test';
import { workPlanItemSchema } from './item';

const base = {
  id: 'WI-20261020-0001',
  ownerUserId: 'U011',
  date: '2026-10-20',
  allDay: false,
  startTime: '10:00',
  endTime: '10:30',
  tagId: 'MEETING',
  title: '주간 회의',
  memo: '',
  createdBy: 'U011',
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
};

test('종일이면 시각이 없어야 한다', () => {
  assert.equal(workPlanItemSchema.safeParse({ ...base, allDay: true, startTime: '09:00', endTime: null }).success, false);
  assert.equal(workPlanItemSchema.safeParse({ ...base, allDay: true, startTime: null, endTime: null }).success, true);
});

test('시간 항목은 시작이 필요하고, 종료가 있으면 시작<종료 (종료 미정 허용)', () => {
  assert.equal(workPlanItemSchema.safeParse({ ...base, startTime: '10:00', endTime: '10:00' }).success, false);
  assert.equal(workPlanItemSchema.safeParse({ ...base, startTime: '10:00', endTime: null }).success, true);
  assert.equal(workPlanItemSchema.safeParse({ ...base, startTime: null, endTime: '10:30' }).success, false);
  assert.equal(workPlanItemSchema.safeParse({ ...base, startTime: null, endTime: null }).success, false);
  assert.equal(workPlanItemSchema.safeParse({ ...base, startTime: '10:00', endTime: '10:30' }).success, true);
});

test('제목은 1~100자', () => {
  assert.equal(workPlanItemSchema.safeParse({ ...base, title: ' ' }).success, false);
  assert.equal(workPlanItemSchema.safeParse({ ...base, title: 'a'.repeat(101) }).success, false);
  assert.equal(workPlanItemSchema.safeParse({ ...base, title: 'a'.repeat(100) }).success, true);
});

test('메모 1000자 초과 실패', () => {
  assert.equal(workPlanItemSchema.safeParse({ ...base, memo: 'a'.repeat(1001) }).success, false);
  assert.equal(workPlanItemSchema.safeParse({ ...base, memo: 'a'.repeat(1000) }).success, true);
});

test('옮기면 날짜만 바뀌고 시각·태그·제목·메모는 그대로다', () => {
  const draft = movedDraft({ id: 'WI-20261102-0001', ownerUserId: 'U1', date: '2026-11-02', allDay: false, startTime: '09:00', endTime: '10:00', tagId: 't', title: '보고서', memo: '메모', createdBy: 'U1', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' }, '2026-11-05');
  assert.deepEqual(draft, { date: '2026-11-05', allDay: false, startTime: '09:00', endTime: '10:00', tagId: 't', title: '보고서', memo: '메모' });
});
