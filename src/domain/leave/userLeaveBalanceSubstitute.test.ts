import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateUserLeaveBalance } from './userLeaveBalance';
import type { SubstituteLedgerEntry } from './substituteLedger';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';

const grant = (userId: string, docId: string, minutes: number): SubstituteLedgerEntry => ({
  id: `SHL-G-${docId}`, userId, kind: 'GRANT', minutes, sourceDocId: docId, sourceDocNo: '', workDate: '2026-11-08',
  expiresOn: '2027-11-08', workMinutes: minutes / 1.5, createdAt: '', createdBy: '', note: '',
});
const subLeave = (id: string, status: string, unit?: string) => ({
  id, docNo: id, docType: '휴가', drafterId: 'U1', drafterName: '김직원', title: '휴가 신청서', status, body: '',
  form: { leaveType: '대체휴무', startDate: '2026-11-16', endDate: '2026-11-16', days: 1 },
  fieldValues: unit ? { leaveUnit: unit } : {},
  createdAt: '2026-11-13T00:00:00Z',
}) as unknown as ApprovalDoc;

test('대체휴무 잔여 — 원장 지급 765분 − 반차 사용 240분 = 525분, 진행 중 반반차 120분', () => {
  const r = calculateUserLeaveBalance({
    user: { userId: 'U1', name: '김직원', hireDate: '2024-01-01' },
    approvalDocs: [subLeave('L1', '완료', '오후반차'), subLeave('L2', '진행중', '반반차')],
    substituteLedger: [grant('U1', 'D1', 765), grant('U2', 'D2', 480)],
    referenceDate: new Date('2026-11-13T00:00:00Z'),
  });
  assert.equal(r.substituteHoliday.totalMin, 765);
  assert.equal(r.substituteHoliday.usedMin, 240);
  assert.equal(r.substituteHoliday.pendingMin, 120);
  assert.equal(r.substituteHoliday.remainingMin, 405);
  assert.equal(r.substituteHoliday.detailList.length, 1);
  assert.equal(r.usedDays, 0); // 대체휴무는 연차에서 빼지 않는다
});

test('원장이 없으면 대체휴무 0', () => {
  const r = calculateUserLeaveBalance({ user: { userId: 'U1', name: '김직원', hireDate: '2024-01-01' }, approvalDocs: [] });
  assert.equal(r.substituteHoliday.totalMin, 0);
  assert.equal(r.substituteHoliday.remainingMin, 0);
});
