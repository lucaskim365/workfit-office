import { z } from 'zod';

/**
 * 생산계획(ProdPlan) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 와이어프레임 prod-screens.ProdPlanContent 의 인라인 Plan 정본.
 * 채번 PL-{YYMMDD}-NN. ERP 수신 계획 기준.
 */
/** 계획 상태 — 확정·검토·수신(ERP 수신). */
export const PLAN_STATUS = ['확정', '검토', '수신'] as const;

export const prodPlanSchema = z.object({
  /** PK — 계획번호 PL-{YYMMDD}-NN. */
  no: z.string().min(1, '계획번호는 필수입니다'),
  /** 품목 코드. */
  code: z.string().min(1, '품목 코드는 필수입니다'),
  /** 품목명. */
  name: z.string().min(1, '품목명은 필수입니다'),
  /** 생산 라인. */
  line: z.string().min(1, '라인은 필수입니다'),
  /** 교대(주간·야간 등). */
  shift: z.string().min(1, '교대는 필수입니다'),
  /** 계획수량(천단위 콤마 포함 표시 문자열). */
  qty: z.string().default(''),
  status: z.enum(PLAN_STATUS),
});

export type ProdPlan = z.infer<typeof prodPlanSchema>;
