import type { ApprovalRouteRule } from './schema';

/**
 * 금액 조건이 걸린 결재선 규칙과 금액 없는 서식 — **순수함수**.
 *
 * 규칙 엔진(engine.ts)은 문서 금액이 없으면 0원으로 계산한다. 시트 서식에 금액 키 칸이 없으면
 * 금액 조건이 뜻과 다르게 걸리므로(예: '100만 원 미만' 규칙에 늘 걸림) 서식을 저장할 때 알려 준다.
 */

/** 이 서식에 걸린(서식 코드 또는 연동 기능 코드가 같은) 켜져 있는 규칙 중 금액 조건이 있는 것 — 우선순위 순 */
export function amountRulesOfForm(rules: ApprovalRouteRule[], docType: string, linkType?: string | null): ApprovalRouteRule[] {
  return rules
    .filter((r) => r.active && (r.amountFrom != null || r.amountTo != null))
    // 전사 공통 규칙(전체)은 뺀다 — 금액이 없는 서식(휴가원 등)마다 알리게 되므로 이 서식을 짚은 규칙만
    .filter((r) => r.docType === docType || (!!linkType && r.docType === linkType))
    .sort((a, b) => a.priority - b.priority);
}

/** 서식 저장 때 알릴 글 — 금액 조건 규칙이 걸려 있는데 시트에 금액 키 칸이 없을 때(저장은 막지 않는다) */
export function missingAmountKeyIssues(
  rules: ApprovalRouteRule[],
  form: { docType: string; linkType?: string | null; hasAmountKey: boolean }
): string[] {
  if (form.hasAmountKey) return [];
  const hit = amountRulesOfForm(rules, form.docType, form.linkType);
  if (!hit.length) return [];
  const names = hit.map((r) => `'${r.name}'`).join(', ');
  return [
    `결재선 규칙 ${names}에 금액 조건이 있는데 시트에 '금액 키' 칸이 없습니다. 이 서식의 문서는 금액이 0원으로 계산되어 규칙이 뜻과 다르게 걸립니다 — 금액 칸을 골라 칸 이름에서 '금액 키'를 붙여 주세요.`,
  ];
}
