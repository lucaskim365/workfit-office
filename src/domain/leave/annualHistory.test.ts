import test from 'node:test';
import assert from 'node:assert/strict';
import { annualLeaveHistoryDocs } from './policy';

const doc = (id: string, status: string, leaveType?: string) => ({ id, status, form: leaveType ? { leaveType } : null });

test('연차 변동 내역에는 결재 완료된 연차 차감 휴가와 대체휴무만 들어간다', () => {
  const docs = [
    doc('annual', '완료', '연차'),
    doc('half', '완료', '오전반차'),
    doc('substitute', '완료', '대체휴무'),
    doc('sick', '완료', '병가'),
    doc('pending', '진행중', '연차'),
    doc('rejected', '반려', '연차'),
    doc('noForm', '완료'),
  ];
  assert.deepEqual(annualLeaveHistoryDocs(docs).map((d) => d.id), ['annual', 'half', 'substitute']);
});
