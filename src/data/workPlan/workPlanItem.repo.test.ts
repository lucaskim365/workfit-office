import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkPlanItemDraft } from '@/domain/workPlan/item';
import { WorkPlanItemError, workPlanItemRepo, type WorkPlanItemActor } from './workPlanItem.repo';

const owner: WorkPlanItemActor = { userId: 'U011', active: true };
const other: WorkPlanItemActor = { userId: 'U012', active: true };

const draft = (over: Partial<WorkPlanItemDraft> = {}): WorkPlanItemDraft => ({
  date: '2026-10-21',
  allDay: false,
  startTime: '09:00',
  endTime: '10:00',
  tagId: 'WT-0001',
  title: '주간 보고 작성',
  memo: '',
  ...over,
});

test('본인 항목을 만들고·고치고·지운다', async () => {
  const created = await workPlanItemRepo.create(owner, owner.userId, draft());
  assert.match(created.id, /^WI-20261021-\d{4}$/);
  assert.equal(created.createdBy, owner.userId);
  assert.equal(created.ownerUserId, owner.userId);
  const updated = await workPlanItemRepo.update(owner, created.id, draft({ title: '수정한 제목' }));
  assert.equal(updated.title, '수정한 제목');
  await workPlanItemRepo.remove(owner, created.id);
  const left = await workPlanItemRepo.listRange({ from: '2026-10-21', to: '2026-10-21' });
  assert.equal(left.some((r) => r.id === created.id), false);
});

test('남의 칸에는 만들 수 없다', async () => {
  await assert.rejects(
    () => workPlanItemRepo.create(owner, 'U012', draft()),
    (e) => e instanceof WorkPlanItemError && e.code === 'FORBIDDEN',
  );
});

test('남의 항목은 고치거나 지울 수 없다', async () => {
  const created = await workPlanItemRepo.create(owner, owner.userId, draft());
  await assert.rejects(
    () => workPlanItemRepo.update(other, created.id, draft()),
    (e) => e instanceof WorkPlanItemError && e.code === 'FORBIDDEN',
  );
  await assert.rejects(
    () => workPlanItemRepo.remove(other, created.id),
    (e) => e instanceof WorkPlanItemError && e.code === 'FORBIDDEN',
  );
});

test('사용 중지 계정은 만들 수 없다', async () => {
  const off: WorkPlanItemActor = { userId: 'U013', active: false };
  await assert.rejects(
    () => workPlanItemRepo.create(off, off.userId, draft()),
    (e) => e instanceof WorkPlanItemError && e.code === 'FORBIDDEN',
  );
});

test('날짜 범위로 전원 것을 읽는다', async () => {
  const a = await workPlanItemRepo.create(owner, owner.userId, draft({ date: '2026-11-05' }));
  const b = await workPlanItemRepo.create(other, other.userId, draft({ date: '2026-11-06' }));
  const c = await workPlanItemRepo.create(owner, owner.userId, draft({ date: '2026-12-01' }));
  const rows = await workPlanItemRepo.listRange({ from: '2026-11-01', to: '2026-11-30' });
  assert.equal(rows.some((r) => r.id === a.id), true);
  assert.equal(rows.some((r) => r.id === b.id), true);
  assert.equal(rows.some((r) => r.id === c.id), false);
});
