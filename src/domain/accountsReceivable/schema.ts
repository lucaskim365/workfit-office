import { z } from 'zod';

/**
 * 채권 accountsReceivable. PK=cust. 조회전용.
 *
 * 거래처별 미수금·연체(Aging) 마스터. 화면(SalesArScreen) 조회 전용 데이터.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 */
export const AR_STATE = ['정상', '연체'] as const;

export const accountsReceivableSchema = z.object({
  /** 거래처명(PK). */
  cust: z.string().min(1, '거래처는 필수입니다'),
  /** 여신한도(원). */
  limit: z.number(),
  /** 0~30일 미만 미수금(원). */
  d30: z.number(),
  /** 31~60일 미수금(원). */
  d60: z.number(),
  /** 연체(60일 초과) 미수금(원). */
  over: z.number(),
  /** 채권 상태 — 정상/연체. */
  status: z.enum(AR_STATE),
});

export type AccountsReceivable = z.infer<typeof accountsReceivableSchema>;
