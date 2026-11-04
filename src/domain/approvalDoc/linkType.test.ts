import assert from 'node:assert/strict';
import test from 'node:test';
import { approvalDocSchema, type ApprovalDoc } from '@/domain/approvalDoc/schema';
import { buildApprovalDayIndex } from '@/domain/commute/approvalDayIndex';
import { extractScheduleInfo } from './scheduleEngine';
import { docLinkType } from './linkType';

function doc(over: Partial<ApprovalDoc> & Pick<ApprovalDoc, 'id' | 'docType'>): ApprovalDoc {
  return approvalDocSchema.parse({ docNo: over.id, title: '시험', drafterId: 'U010', drafterName: '박광래', status: '완료', ...over });
}

test('연동 유형 — 기존 문서는 서식 코드 그대로, 시트 서식 문서는 __link', () => {
  assert.equal(docLinkType({ docType: '외근' }), '외근');
  assert.equal(docLinkType({ docType: '외근', fieldValues: {} }), '외근');
  assert.equal(docLinkType({ docType: '외근_시트', fieldValues: { __link: '외근' } }), '외근');
  assert.equal(docLinkType({ docType: '발주_시트', fieldValues: { __link: '' } }), '발주_시트');
});

test('시트 외근 문서도 근태·일정에 기존 외근처럼 연결된다', () => {
  const sheetDoc = doc({ id: 'AP-2', docType: '외근_시트', fieldValues: { __link: '외근', period: '2026-11-05', destination: '에이스메디칼' } });
  const index = buildApprovalDayIndex([sheetDoc]);
  assert.deepEqual(index.lookup({ id: 'U010' }).get('2026-11-05')?.map((e) => e.category), ['OUTSIDE']);
  assert.equal(extractScheduleInfo(sheetDoc)?.category, 'OUTSIDE');
  // __link 가 없으면 연동 안 됨(새 서식은 연동 없는 서식)
  const plain = doc({ id: 'AP-3', docType: '외근_시트', fieldValues: { period: '2026-11-05' } });
  assert.equal(extractScheduleInfo(plain), null);
});

test('시트 휴일근무 문서도 휴일근무로 인정된다', () => {
  const index = buildApprovalDayIndex([doc({ id: 'AP-4', docType: '휴일근무_시트', fieldValues: { __link: '휴일근무', workDate: '2026-11-07' } })]);
  assert.deepEqual(index.lookup({ id: 'U010' }).get('2026-11-07')?.map((e) => e.category), ['HOLIDAY_WORK']);
});

test('결재선 — 연동 유형이 있으면 대체한 서식의 규칙도 맞는다', async () => {
  const { resolveRoute } = await import('@/domain/approvalRoute/engine');
  const rule = {
    id: 'R1', name: '외근 규칙', priority: 1, active: true, formId: null, docType: '외근', conditionKey: null, conditionValues: [],
    deptScope: { kind: '전체', deptId: null, deptType: null }, positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [{ resolver: 'SPECIFIC_USER', arg: 'U001', kind: '결재', dedupeSelf: true, optional: false }],
  } as never;
  const users = [
    { id: 'U010', name: '박광래', dept: 'A', position: '사원', status: '사용' },
    { id: 'U001', name: '대표', dept: 'A', position: '대표이사', status: '사용' },
  ] as never[];
  const base = { drafter: users[0], amount: null, users, depts: [], positions: [], rules: [rule] } as never as Parameters<typeof resolveRoute>[0];
  assert.equal(resolveRoute({ ...base, docType: '외근_시트' }).rule, null);
  assert.equal(resolveRoute({ ...base, docType: '외근_시트', linkType: '외근' }).rule?.id, 'R1');
  assert.equal(resolveRoute({ ...base, docType: '외근' }).rule?.id, 'R1'); // 기존 그대로
});
