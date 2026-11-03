import assert from 'node:assert/strict';
import test from 'node:test';
import { approvalDocSchema, type ApprovalDoc } from '@/domain/approvalDoc/schema';
import { formCounts, pinnedForms } from './completedForms';

const doc = (id: string, docType: string): ApprovalDoc =>
  approvalDocSchema.parse({ id, docNo: `NO-${id}`, docType, title: id, drafterId: 'U011', submittedAt: null, createdAt: '2026-09-01T00:00:00Z' });

const docs = [doc('1', '품의'), doc('2', '기안'), doc('3', '품의'), doc('4', 'OUTWORK'), doc('5', '휴가'), doc('6', '기안'), doc('7', '품의')];

test('서식별 문서 수는 많은 순, 같으면 code 순', () => {
  assert.deepEqual(formCounts(docs), [
    { code: '품의', count: 3 },
    { code: '기안', count: 2 },
    { code: 'OUTWORK', count: 1 },
    { code: '휴가', count: 1 },
  ]);
});

test('고른 적이 없으면 문서가 많은 서식 3개', () => {
  assert.deepEqual(pinnedForms(null, docs), ['품의', '기안', 'OUTWORK']);
});

test('고른 값이 있으면 문서가 없어도 그대로(빈 목록 포함)', () => {
  assert.deepEqual(pinnedForms(['휴가', '없는서식'], docs), ['휴가', '없는서식']);
  assert.deepEqual(pinnedForms([], docs), []);
});
