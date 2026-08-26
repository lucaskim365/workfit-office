import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkPlanDraft } from '@/domain/workPlan/schema';
import { WorkPlanError, workPlanRepo, type WorkPlanActor } from './workPlan.repo';

const owner: WorkPlanActor = { userId: 'U011', active: true };
const other: WorkPlanActor = { userId: 'U012', active: true };

const draft = (content: string): WorkPlanDraft => ({ date: '2026-08-27', content });

test('본인 계획을 생성·수정·삭제한다', async () => {
  const created = await workPlanRepo.create(owner, draft('영업 미팅'));
  assert.equal(created.ownerUserId, owner.userId);
  const updated = await workPlanRepo.update(owner, created.id, draft('영업 미팅(변경)'));
  assert.equal(updated.content, '영업 미팅(변경)');
  await workPlanRepo.remove(owner, created.id);
  assert.deepEqual(await workPlanRepo.list(owner, { from: '2026-08-01', to: '2026-08-31' }), []);
});

test('전체 보기는 공유 판정 없이 다 보이지만, 남의 것은 못 고친다', async () => {
  const mine = await workPlanRepo.create(owner, draft('내 계획'));
  const others = await workPlanRepo.create(other, draft('남의 계획'));

  const all = await workPlanRepo.listAll({ from: '2026-08-01', to: '2026-08-31' });
  assert.equal(all.some((row) => row.id === mine.id), true);
  assert.equal(all.some((row) => row.id === others.id), true);

  // 내 목록에는 본인 것만.
  const onlyMine = await workPlanRepo.list(owner, { from: '2026-08-01', to: '2026-08-31' });
  assert.equal(onlyMine.every((row) => row.ownerUserId === owner.userId), true);

  await assert.rejects(
    () => workPlanRepo.update(other, mine.id, draft('가로채기')),
    (error) => error instanceof WorkPlanError && error.code === 'NOT_FOUND',
  );
  await assert.rejects(() => workPlanRepo.remove(other, mine.id));

  await workPlanRepo.remove(owner, mine.id);
  await workPlanRepo.remove(other, others.id);
});

test('비활성 계정은 쓰기가 막히고 조회는 빈 목록이다', async () => {
  const inactive: WorkPlanActor = { userId: 'U099', active: false };
  await assert.rejects(() => workPlanRepo.create(inactive, draft('불가')));
  assert.deepEqual(await workPlanRepo.list(inactive), []);
});
