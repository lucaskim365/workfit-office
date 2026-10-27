import assert from 'node:assert/strict';
import test from 'node:test';
import { mealTicketRepo } from './mealTicket.repo';

test('체크·입고·메모는 그날 문서 하나에 모이고, 서로의 칸을 덮지 않는다', async () => {
  await mealTicketRepo.setReceived('2026-10-27', 'A', true, '가');
  await mealTicketRepo.setReceived('2026-10-27', 'B', true, '나');
  await mealTicketRepo.setStockIn('2026-10-27', 300, '가');
  await mealTicketRepo.setMemo('2026-10-27', '분실 1', '나');
  await mealTicketRepo.setReceived('2026-10-27', 'A', false, '가');
  // 이미 있는 사람을 다시 체크해도 한 번만
  await mealTicketRepo.setReceived('2026-10-27', 'B', true, '가');
  await mealTicketRepo.setReceived('2026-10-26', 'C', true, '가');

  const all = await mealTicketRepo.list();
  assert.deepEqual(all.map((d) => d.date), ['2026-10-26', '2026-10-27']);
  const d = all[1];
  assert.deepEqual(d.recipients, ['B']);
  assert.equal(d.stockIn, 300);
  assert.equal(d.memo, '분실 1');
  assert.equal(d.updatedBy, '가');
});
