import assert from 'node:assert/strict';
import test from 'node:test';
import { applyDecision, submit, withoutJeongyeol } from './engine';
import { approvalDocSchema, type ApprovalDoc } from './schema';
import { resolveRoute } from '@/domain/approvalRoute/engine';

// 2026-10-23 긴급 수정 — 전결 선택지를 지운 뒤에도 '전결' 값이 남아, 화면엔 '결재'로 보이는데
// 전결자가 승인하면 뒤 결재자를 건너뛰고 완료되던 문제 (AP-261023-001·003)

const mk = (steps: Array<Partial<ApprovalDoc['steps'][number]>>, over: Partial<ApprovalDoc> = {}): ApprovalDoc =>
  approvalDocSchema.parse({
    id: 'D1', docNo: 'D1', docType: '지출결의', title: '문서', drafterId: 'DR', status: '진행중',
    steps: steps.map((s, i) => ({ seq: i + 1, kind: '결재', approverId: `A${i + 1}`, decision: '대기', ...s })),
    ...over,
  });

test('전결 뒤에 결재자가 남아 있으면 전결자 승인으로 완료되지 않고 다음 결재자로 넘어간다', () => {
  const doc = mk([{ kind: '전결' }, { kind: '결재' }]);
  const next = applyDecision(doc, 1, '승인', { at: '2026-10-23T06:00:00Z' });
  assert.equal(next.status, '진행중');
  assert.equal(next.currentSeq, 2);
});

test('예전 문서 — 전결 뒤에 참조만 있으면 전결자 승인으로 완료된다(기존 동작 유지)', () => {
  const doc = mk([{ kind: '결재', decision: '승인' }, { kind: '전결' }, { kind: '참조' }]);
  const next = applyDecision(doc, 2, '승인', { at: '2026-10-23T06:00:00Z' });
  assert.equal(next.status, '완료');
});

test('상신할 때 전결은 결재로 바뀐다', () => {
  const doc = mk([{ kind: '전결' }, { kind: '결재' }, { kind: '참조' }], { status: '임시저장' });
  const sent = submit(doc, '2026-10-23T06:00:00Z');
  assert.deepEqual(sent.steps.map((s) => s.kind), ['결재', '결재', '참조']);
});

test('withoutJeongyeol — 전결만 결재로, 나머지 구분은 그대로', () => {
  const steps = mk([{ kind: '전결' }, { kind: '합의' }, { kind: '참조' }, { kind: '결재' }]).steps;
  assert.deepEqual(withoutJeongyeol(steps).map((s) => s.kind), ['결재', '합의', '참조', '결재']);
});

test('자동 결재선 — 규칙의 전결·폴백 전결 모두 결재로 만든다', () => {
  const users = [
    { id: 'DR', name: '기안자', dept: '개발팀', position: '사원', managerId: null, status: '사용' },
    { id: 'TL', name: '팀장', dept: '개발팀', position: '팀장', managerId: null, status: '사용' },
  ] as any[];
  const depts = [{ id: 'D-DEV', name: '개발팀', parentId: null, headUserId: 'TL' }] as any[];
  const base = { drafter: users[0], docType: '지출결의', amount: null, users, depts, positions: [] };

  // 폴백 (규칙 없음) — 예전엔 부서장 '전결'
  const fallback = resolveRoute({ ...base, rules: [] });
  assert.ok(fallback.steps.length > 0);
  assert.ok(fallback.steps.every((s) => s.kind !== '전결'));

  // 규칙에 전결 단계 (RR-FALLBACK: 전결:DEPT_HEAD)
  const rule = {
    id: 'RR-FALLBACK', name: '폴백', docType: '전체', deptScope: { kind: '전체' }, priority: 99, active: true,
    positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
    steps: [{ kind: '전결', resolver: 'DEPT_HEAD', dedupeSelf: true }],
  } as any;
  const ruled = resolveRoute({ ...base, rules: [rule] });
  assert.deepEqual(ruled.steps.map((s) => [s.kind, s.approverId]), [['결재', 'TL']]);
});

// 2026-10-23 전결 시스템에서 삭제
test('예전 규칙의 전결 단계는 읽을 때 결재가 된다', async () => {
  const { approvalRouteRuleSchema } = await import('@/domain/approvalRoute/schema');
  const rule = approvalRouteRuleSchema.parse({
    id: 'RR-X', name: '예전 규칙', steps: [{ resolver: 'DEPT_HEAD', kind: '결재' }, { resolver: 'PARENT_DEPT_HEAD', arg: 1, kind: '전결' }, { resolver: 'ROLE_CEO', kind: '참조' }],
  });
  assert.deepEqual(rule.steps.map((s) => s.kind), ['결재', '결재', '참조']);
});

test('결재 진행 중 전결 단계가 남아 있어도 건너뛰지 않는다 — 마지막 결재자가 승인해야 완료', () => {
  const doc = mk([{ kind: '전결' }, { kind: '결재' }, { kind: '참조' }]);
  const first = applyDecision(doc, 1, '승인', { at: '2026-10-23T06:00:00Z' });
  assert.equal(first.status, '진행중');
  const last = applyDecision(first, 2, '승인', { at: '2026-10-23T07:00:00Z' });
  assert.equal(last.status, '완료');
});
