import assert from 'node:assert/strict';
import test from 'node:test';
import { mealTicketRepo } from './mealTicket.repo';

test('체크·입고·메모는 그날 문서 하나에 모이고, 서로의 칸을 덮지 않는다', async () => {
  await mealTicketRepo.setReceived('2026-10-27', ['A'], true, '가');
  await mealTicketRepo.setReceived('2026-10-27', ['B'], true, '나');
  await mealTicketRepo.setStockIn('2026-10-27', 300, '가');
  await mealTicketRepo.setMemo('2026-10-27', '분실 1', '나');
  await mealTicketRepo.setReceived('2026-10-27', ['A'], false, '가');
  // 이미 있는 사람을 다시 체크해도 한 번만
  await mealTicketRepo.setReceived('2026-10-27', ['B'], true, '가');
  await mealTicketRepo.setReceived('2026-10-26', ['C'], true, '가');

  const all = await mealTicketRepo.list();
  const d = all.find((x) => x.date === '2026-10-27')!;
  assert.deepEqual(d.recipients, ['B']);
  assert.equal(d.stockIn, 300);
  assert.equal(d.memo, '분실 1');
  assert.equal(d.updatedBy, '가');
});

test('같은 날을 기다리지 않고 연달아 고쳐도(빠른 클릭·드래그) 앞의 변경이 사라지지 않는다', async () => {
  await Promise.all([
    mealTicketRepo.setReceived('2026-11-02', ['A'], true, '가'),
    mealTicketRepo.setReceived('2026-11-02', ['B', 'C'], true, '가'),
    mealTicketRepo.setStockIn('2026-11-02', 50, '가'),
    mealTicketRepo.setReceived('2026-11-02', ['C'], false, '가'),
  ]);
  const d = (await mealTicketRepo.list()).find((x) => x.date === '2026-11-02')!;
  assert.deepEqual(d.recipients, ['A', 'B']);
  assert.equal(d.stockIn, 50);
});
