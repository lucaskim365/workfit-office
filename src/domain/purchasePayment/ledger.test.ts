import assert from 'node:assert/strict';
import test from 'node:test';
import { expenseStatusOf, toLedgerRows, vendorKey } from './ledger';
import { purchasePaymentSchema, type PurchasePaymentRecord } from './schema';

const rec = (docId: string, docNo: string, seq: number, over: Partial<PurchasePaymentRecord> = {}): PurchasePaymentRecord =>
  purchasePaymentSchema.parse({ id: `${docId}__${seq}`, docId, docNo, seq, term: seq === 1 ? '선금' : '잔금', rate: 50, supply: 1000, ...over });

test('대장 번호 — 발주서마다 하나(문서번호 순), 같은 발주의 줄은 번호가 같다', () => {
  const rows = toLedgerRows([rec('B', 'AP-002', 2), rec('A', 'AP-001', 1), rec('B', 'AP-002', 1), rec('A', 'AP-001', 2)], () => '완료');
  assert.deepEqual(rows.map((r) => [r.no, r.poDocNo, r.term]), [
    [1, 'AP-001', '선금'],
    [1, 'AP-001', '잔금'],
    [2, 'AP-002', '선금'],
    [2, 'AP-002', '잔금'],
  ]);
});

test('취소·삭제된 발주서의 줄은 대장에서 빠진다 — 발주서를 못 찾은 줄은 그대로', () => {
  const status: Record<string, string> = { A: '완료', B: '취소완료', C: '삭제' };
  const rows = toLedgerRows([rec('A', 'AP-001', 1), rec('B', 'AP-002', 1), rec('C', 'AP-003', 1), rec('D', 'AP-004', 1)], (id) => status[id]);
  assert.deepEqual(rows.map((r) => r.poDocNo), ['AP-001', 'AP-004']);
  assert.deepEqual(rows.map((r) => r.no), [1, 2]);
});

test('지출결의서 진행 — 이 줄로 기안한 문서의 상태를 따라간다', () => {
  const status: Record<string, string> = { A: '완료', E1: '진행중', E2: '완료', E3: '반려' };
  const rows = toLedgerRows(
    [rec('A', 'AP-001', 1, { expenseDocId: 'E1' }), rec('A', 'AP-001', 2, { expenseDocId: 'E2' }), rec('A', 'AP-001', 3, { expenseDocId: 'E3' }), rec('A', 'AP-001', 4), rec('A', 'AP-001', 5, { expenseDocId: 'GONE' })],
    (id) => status[id]
  );
  assert.deepEqual(rows.map((r) => r.expense), ['inProgress', 'approved', 'rejected', 'none', 'none']);
  assert.equal(expenseStatusOf('임시저장'), 'drafting');
  assert.equal(expenseStatusOf('긴급 조치 사후 검토 반려'), 'rejected');
  assert.equal(expenseStatusOf('취소완료'), 'none');
});

test('발주처 이름 맞추기 — 띄어쓰기를 무시한다', () => {
  assert.equal(vendorKey('(주) 미르 시스템'), vendorKey('(주)미르시스템'));
});
