import assert from 'node:assert/strict';
import test from 'node:test';
import { createMasterRepo } from './masters.repo';

type R = { id: string; name: string; use: boolean; order: number; createdBy: string; createdAt: string; updatedBy: string; updatedAt: string };
function mem() {
  const rows = new Map<string, R>();
  const calls: string[] = [];
  return {
    rows, calls,
    async loadAll() { return [...rows.values()]; },
    async insert(x: R) { calls.push(`insert ${x.id}`); rows.set(x.id, x); },
    async save(x: R) { calls.push(`save ${x.id}`); rows.set(x.id, x); },
  };
}
const r = (over: Partial<R> = {}): R => ({ id: 'X-1', name: ' 제조AI ', use: true, order: 10, createdBy: '', createdAt: '', updatedBy: '', updatedAt: '', ...over });

test('새 항목은 insert, 이름 앞뒤 공백 제거, 만든 사람·시각 기록', async () => {
  const b = mem();
  const saved = await createMasterRepo(b).save({ item: r(), isNew: true, actorId: 'U1' });
  assert.deepEqual(b.calls, ['insert X-1']);
  assert.equal(saved.name, '제조AI');
  assert.equal(saved.createdBy, 'U1');
  assert.ok(saved.createdAt && saved.updatedAt);
});

test('수정은 save, 처음 만든 기록은 그대로', async () => {
  const b = mem();
  const saved = await createMasterRepo(b).save({ item: r({ createdBy: 'U0', createdAt: 't0' }), isNew: false, actorId: 'U2' });
  assert.deepEqual(b.calls, ['save X-1']);
  assert.equal(saved.createdBy, 'U0');
  assert.equal(saved.createdAt, 't0');
  assert.equal(saved.updatedBy, 'U2');
});
