import { z } from 'zod';

/**
 * 예방보전(PM) 계획 마스터(PmPlan) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5: 이 정의가 곧 RDB 테이블 DDL)
 *
 * 설계서 2.4 예방보전 pmPlans. PK=id.
 * 계획 마스터이므로 상태머신은 없다(상태는 표시용 라벨: 정상/임박/진행중/지연/완료 등 다양).
 */
export const pmPlanSchema = z.object({
  /** 합성 PK — `${eq}__${item}` slug. */
  id: z.string().min(1, 'PM 계획 ID는 필수입니다'),
  /** 대상 설비. */
  eq: z.string().min(1, '설비는 필수입니다'),
  /** 보전 항목. */
  item: z.string().min(1, '보전 항목은 필수입니다'),
  /** 보전 유형(일상/주간/월간/분기/연간 등 다양). */
  pmType: z.string(),
  /** 점검 주기(예: 30일). */
  cycle: z.string(),
  /** 최근 수행일. */
  last: z.string(),
  /** 다음 예정일. */
  next: z.string(),
  /** 담당자. */
  mgr: z.string(),
  /** 상태 라벨(정상/임박/진행중/지연/완료 등 다양). */
  status: z.string(),
});

export type PmPlan = z.infer<typeof pmPlanSchema>;
