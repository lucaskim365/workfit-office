import type { ApprovalRule } from '@/domain/approvalRule/schema';

/**
 * 전결규정 시드 — Firebase 미설정 시 폴백 + 초기 seed.
 * 금액 구간은 [amountFrom, amountTo) 반개구간(원 단위).
 * 지출결의·품의는 금액 구간별 전결권자, 기안·휴가는 금액 무관 단일 규정.
 */
export const APPROVAL_RULE_SEED: ApprovalRule[] = [
  // 지출결의: ~100만 팀장 / ~1000만 부서장 / 초과 대표
  { id: 'R-EXP-1', docType: '지출결의', amountFrom: 0, amountTo: 1_000_000, finalApproverKey: '팀장' },
  { id: 'R-EXP-2', docType: '지출결의', amountFrom: 1_000_000, amountTo: 10_000_000, finalApproverKey: '부서장' },
  { id: 'R-EXP-3', docType: '지출결의', amountFrom: 10_000_000, amountTo: null, finalApproverKey: '대표' },
  // 품의: ~500만 팀장 / ~5000만 부서장 / 초과 대표
  { id: 'R-PUR-1', docType: '품의', amountFrom: 0, amountTo: 5_000_000, finalApproverKey: '팀장' },
  { id: 'R-PUR-2', docType: '품의', amountFrom: 5_000_000, amountTo: 50_000_000, finalApproverKey: '부서장' },
  { id: 'R-PUR-3', docType: '품의', amountFrom: 50_000_000, amountTo: null, finalApproverKey: '대표' },
  // 기안·휴가: 금액 무관 — 팀장 전결
  { id: 'R-GEN-1', docType: '기안', amountFrom: null, amountTo: null, finalApproverKey: '팀장' },
  { id: 'R-LEAVE-1', docType: '휴가', amountFrom: null, amountTo: null, finalApproverKey: '팀장' },
];
