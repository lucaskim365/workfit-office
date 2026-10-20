import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkPlanTagError } from '@/domain/workPlan/tag';
import { workPlanTagRepo } from './workPlanTag.repo';

test('id는 WT-0001부터', async () => {
  const first = await workPlanTagRepo.create({ name: '첫태그', colorId: 'blue', order: 1, hidden: false });
  assert.equal(first.id, 'WT-0001');
  const second = await workPlanTagRepo.create({ name: '둘째태그', colorId: 'teal', order: 2, hidden: false });
  assert.equal(second.id, 'WT-0002');
});

test('이름 중복이면 DUPLICATE', async () => {
  await workPlanTagRepo.create({ name: '중복검사', colorId: 'blue', order: 3, hidden: false });
  await assert.rejects(
    () => workPlanTagRepo.create({ name: '중복검사', colorId: 'rose', order: 4, hidden: false }),
    (e) => e instanceof WorkPlanTagError && e.code === 'DUPLICATE',
  );
});

test('숨김으로 바꾸면 같은 이름을 새로 만들 수 있다', async () => {
  const tag = await workPlanTagRepo.create({ name: '숨길태그', colorId: 'blue', order: 5, hidden: false });
  await workPlanTagRepo.update(tag.id, { name: '숨길태그', colorId: 'blue', order: 5, hidden: true });
  const again = await workPlanTagRepo.create({ name: '숨길태그', colorId: 'blue', order: 6, hidden: false });
  assert.notEqual(again.id, tag.id);
  const all = await workPlanTagRepo.list();
  assert.equal(all.some((t) => t.id === tag.id && t.hidden), true);
});

test('고정 태그 id는 고칠 수 없다', async () => {
  await assert.rejects(
    () => workPlanTagRepo.update('MEETING', { name: '회의2', colorId: 'blue', order: 1, hidden: false }),
    (e) => e instanceof WorkPlanTagError && e.code === 'FIXED',
  );
});
