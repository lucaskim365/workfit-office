import assert from 'node:assert/strict';
import test from 'node:test';
import { approvalRouteRuleSchema, type ApprovalRouteRule } from './schema';
import { amountRulesOfForm, missingAmountKeyIssues } from './amountRules';

const rule = (r: Record<string, unknown>): ApprovalRouteRule => approvalRouteRuleSchema.parse({ id: String(r.name), ...r });

const rules = [
  rule({ name: '지출 100만 이상', docType: '지출결의', amountFrom: 1000000, priority: 20 }),
  rule({ name: '지출 100만 미만', docType: '지출결의', amountTo: 1000000, priority: 10 }),
  rule({ name: '지출 기본', docType: '지출결의' }),
  rule({ name: '꺼 둔 규칙', docType: '지출결의', amountFrom: 5000000, active: false }),
  rule({ name: '출장 경비', docType: '국내출장', amountFrom: 300000 }),
  rule({ name: '전사 1,000만 이상', docType: '전체', amountFrom: 10000000 }),
];

test('금액 조건 규칙 — 이 서식을 짚은 켜진 규칙만, 우선순위 순', () => {
  assert.deepEqual(amountRulesOfForm(rules, '지출결의').map((r) => r.name), ['지출 100만 미만', '지출 100만 이상']);
  assert.deepEqual(amountRulesOfForm(rules, '휴가'), [], '전사 공통 규칙은 빼고 본다');
  // 연동 기능 코드로 이어받는 규칙도 이 서식에 걸린다(엔진과 같은 기준)
  assert.deepEqual(amountRulesOfForm(rules, '출장신청_시트', '국내출장').map((r) => r.name), ['출장 경비']);
});

test('금액 키 칸이 없는 시트 — 금액 조건 규칙이 걸려 있으면 알린다', () => {
  const issues = missingAmountKeyIssues(rules, { docType: '지출결의', hasAmountKey: false });
  assert.equal(issues.length, 1);
  assert.ok(issues[0].includes("'지출 100만 미만', '지출 100만 이상'"));
  assert.ok(issues[0].includes('금액 키'));
  assert.deepEqual(missingAmountKeyIssues(rules, { docType: '지출결의', hasAmountKey: true }), [], '금액 키 칸이 있으면 알리지 않음');
  assert.deepEqual(missingAmountKeyIssues(rules, { docType: '휴가', hasAmountKey: false }), [], '금액 조건 규칙이 없는 서식');
  assert.deepEqual(missingAmountKeyIssues([], { docType: '지출결의', hasAmountKey: false }), []);
});
