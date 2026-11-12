import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedLeavesInMonth } from './monthLeaves.ts';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';

const doc = (id: string, over: Partial<ApprovalDoc> & { start: string; end?: string }): ApprovalDoc =>
  ({
    id,
    docType: '휴가',
    status: '완료',
    title: '휴가',
    fieldValues: {},
    form: { leaveType: '연차', startDate: over.start, endDate: over.end ?? over.start, days: 1 },
    ...over,
  }) as unknown as ApprovalDoc;

test('그 달에 걸친 승인 휴가만, 시작일 순', () => {
  const list = approvedLeavesInMonth(
    [
      doc('b', { start: '2026-11-20' }),
      doc('a', { start: '2026-10-30', end: '2026-11-02' }),
      doc('x', { start: '2026-12-01' }),
      doc('p', { start: '2026-11-05', status: '진행중' } as never),
    ],
    '2026-11'
  );
  assert.deepEqual(list.map((l) => l.doc.id), ['a', 'b']);
});

test('달을 통째로 걸친 휴가도 넣는다', () => {
  assert.equal(approvedLeavesInMonth([doc('a', { start: '2026-10-28', end: '2026-12-03' })], '2026-11').length, 1);
});
