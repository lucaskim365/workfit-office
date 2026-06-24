import { z } from 'zod';

/**
 * 여신 creditLimits. PK=cust. 조회전용.
 * 도메인 스키마 — 단일 진실 공급원(SSOT). 폼·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 와이어프레임 sales-screens.jsx 여신한도(Credit Limit) 인라인 mock 이관.
 */
export const CREDIT_GRADES = ['A', 'B', 'C'] as const;

export const creditLimitSchema = z.object({
  /** 거래처명 (PK). */
  cust: z.string().min(1, '거래처는 필수입니다'),
  /** 여신한도(원). */
  limit: z.number(),
  /** 사용액(채권잔액, 원). */
  balance: z.number(),
  /** 여신 등급 A/B/C. */
  grade: z.enum(CREDIT_GRADES),
});

export type CreditLimit = z.infer<typeof creditLimitSchema>;
