import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentExistsError } from '@/data/_backend/crudBackend';
import type { SubstituteLedgerEntry } from '@/domain/leave/substituteLedger';
import { createSubstituteLedgerRecorder } from './substituteLedger.repo';

function fakeBackend(initial: SubstituteLedgerEntry[] = []) {
  const rows = new Map(initial.map((e) => [e.id, e]));
  return {
    rows,
    loadAll: async () => [...rows.values()],
    insert: async (e: SubstituteLedgerEntry) => {
      if (rows.has(e.id)) throw new DocumentExistsError('substituteHolidayLedger', e.id);
      rows.set(e.id, e);
    },
  };
}

const policy = { breakStartTime: '12:30', breakEndTime: '13:30' };
const doc = (status: string) => ({
  id: 'D1', docNo: 'AP-1', docType: '휴일근무', status, drafterId: 'U1',
  fieldValues: { workDate: '2026-11-08', workKind: '휴일', workStart: '08:30', workEnd: '18:00' },
});

test('완료 → 지급 한 줄, 다시 불러도 그대로', async () => {
  const b = fakeBackend();
  const rec = createSubstituteLedgerRecorder(b, async () => policy);
  assert.equal(await rec.recordForDoc(doc('완료')), 1);
  assert.equal(await rec.recordForDoc(doc('완료')), 0);
  assert.equal(b.rows.get('SHL-G-D1')!.minutes, 765);
});

test('시행대기도 완료로 본다', async () => {
  const b = fakeBackend();
  const rec = createSubstituteLedgerRecorder(b, async () => policy);
  assert.equal(await rec.recordForDoc(doc('시행대기')), 1);
});

test('취소완료 → 차감 한 줄', async () => {
  const b = fakeBackend();
  const rec = createSubstituteLedgerRecorder(b, async () => policy);
  await rec.recordForDoc(doc('완료'));
  assert.equal(await rec.recordForDoc(doc('취소완료')), 1);
  assert.equal(b.rows.get('SHL-R-D1')!.minutes, -765);
});

test('다른 곳에서 먼저 넣었으면(같은 id) 건너뛴다', async () => {
  const b = fakeBackend();
  const realInsert = b.insert;
  const rec = createSubstituteLedgerRecorder({ loadAll: async () => [], insert: realInsert }, async () => policy);
  await realInsert({ id: 'SHL-G-D1' } as SubstituteLedgerEntry);
  assert.equal(await rec.recordForDoc(doc('완료')), 0);
});

test('휴일근로가 아니면 아무것도 하지 않는다', async () => {
  const b = fakeBackend();
  const rec = createSubstituteLedgerRecorder(b, async () => policy);
  assert.equal(await rec.recordForDoc({ ...doc('완료'), docType: '휴가' }), 0);
  assert.equal(b.rows.size, 0);
});
