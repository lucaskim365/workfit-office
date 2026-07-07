import { z } from 'zod';
import { DOC_TYPES } from '@/domain/approvalDoc/schema';

/**
 * 전결규정(approvalRule) 도메인 스키마 — 단일 진실 공급원(SSOT).
 *
 * 문서유형·금액 구간별 **전결권자**를 정의해, 결재선 자동 구성(§4.1 ③)에서
 * 전결권자 이하로 결재선을 절단/지정하는 근거가 된다.
 * ([[groupware-feature]] · docs/전자결재_워크플로_개발_계획서.md §5.3)
 */

/** 전결권자 키 — 조직 계층상 직위(useOrgTree 상급자 체인/부서장과 매핑). */
export const FINAL_APPROVER_KEYS = ['팀장', '부서장', '본부장', '대표'] as const;
export type FinalApproverKey = (typeof FINAL_APPROVER_KEYS)[number];

export const approvalRuleSchema = z.object({
  /** 규정 ID(PK). */
  id: z.string().min(1),
  /** 적용 문서유형. */
  docType: z.enum(DOC_TYPES),
  /** 금액 구간 하한(포함). null=하한 없음. */
  amountFrom: z.number().nullable().default(null),
  /** 금액 구간 상한(미만). null=상한 없음(초과 구간). */
  amountTo: z.number().nullable().default(null),
  /** 전결권자 — 이 직위까지만 결재선이 유효(이하 절단). */
  finalApproverKey: z.enum(FINAL_APPROVER_KEYS),
});

export type ApprovalRule = z.infer<typeof approvalRuleSchema>;

/**
 * 문서유형·금액에 맞는 전결규정을 찾는다(순수 도출).
 * 구간은 [amountFrom, amountTo) 반개구간, null 은 무한대로 취급.
 */
export function matchRule(rules: ApprovalRule[], docType: string, amount: number | null): ApprovalRule | null {
  const amt = amount ?? 0;
  return (
    rules
      .filter((r) => r.docType === docType)
      .find((r) => (r.amountFrom ?? -Infinity) <= amt && amt < (r.amountTo ?? Infinity)) ?? null
  );
}
