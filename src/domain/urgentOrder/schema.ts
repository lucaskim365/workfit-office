import { z } from 'zod';

/**
 * 긴급오더 urgentOrders. PK=no.
 *
 * 긴급/재작업 지시 발령 이력(로그 마스터) — 단일 진실 공급원(SSOT).
 * 각 행 = 1 도큐먼트. 와이어프레임 UrgentScreen 의 인라인 Tx 이관.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 */
export const UO_TYPES = ['긴급', '재작업'] as const;
export const UO_PRIO = ['최우선', '높음', '보통'] as const;
export const UO_STATE = ['발령', '진행중', '완료'] as const;

export const urgentOrderSchema = z.object({
  /** 지시번호(PK). UR-/RW- 채번. */
  no: z.string().min(1, '지시번호는 필수입니다'),
  type: z.enum(UO_TYPES),
  /** 발령 일시(MM-DD HH:mm). */
  date: z.string(),
  /** 대상 품목명. */
  name: z.string(),
  qty: z.number(),
  prio: z.enum(UO_PRIO),
  /** 긴급/재작업 사유. */
  reason: z.string(),
  /** 대상 라인. */
  line: z.string(),
  /** 발령자. */
  by: z.string(),
  state: z.enum(UO_STATE),
});

export type UrgentOrder = z.infer<typeof urgentOrderSchema>;
