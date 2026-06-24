import { z } from 'zod';

/**
 * 설비 검교정 주기·계획 calPlans. PK=sn. 조회전용.
 * 단일 진실 공급원(SSOT) — 폼·Firestore·타입을 이 스키마에서 파생한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5: 스키마가 곧 테이블 DDL)
 */
export const calPlanSchema = z.object({
  /** 계측기 일련번호(PK·문서ID). */
  sn: z.string().min(1, '계측기 일련번호는 필수입니다'),
  name: z.string().min(1, '계측기명은 필수입니다'),
  /** 계측기 분류(압력계·마이크로미터 등). */
  cat: z.string().default(''),
  /** 검교정 주기(개월). */
  cycle: z.number().int().positive(),
  /** 최근 검교정일(YYYY-MM-DD). */
  lastCal: z.string().default(''),
  /** 차기 예정일(YYYY-MM-DD). */
  nextCal: z.string().default(''),
  /** 의뢰기관. */
  org: z.string().default(''),
  /** 관리 부서. */
  dept: z.string().default(''),
});

export type CalPlan = z.infer<typeof calPlanSchema>;
