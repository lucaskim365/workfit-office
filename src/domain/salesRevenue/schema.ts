import { z } from 'zod';

/**
 * 매출 salesRevenues. PK=no.
 * 출하 기반 매출 전표(Billing) — 로그 마스터. 1행 = 1 도큐먼트.
 * 단일 진실 공급원(SSOT): 폼·Firestore 검증·타입을 모두 이 스키마에서 파생.
 * (와이어프레임 sales-screens.jsx 의 인라인 mock 이관)
 */
export const SR_STATUS = ['확정', '전표대기'] as const;

export const salesRevenueSchema = z.object({
  /** 매출번호 — PK. */
  no: z.string().min(1, '매출번호는 필수입니다'),
  /** 출하지시번호(do_ 예약어 회피용 doNo). */
  doNo: z.string().min(1, '출하번호는 필수입니다'),
  /** 거래처명. */
  cust: z.string().min(1, '거래처는 필수입니다'),
  /** 매출일(YYYY-MM-DD). */
  date: z.string().default(''),
  /** 공급가액. */
  supply: z.number(),
  /** 부가세. */
  vat: z.number(),
  /** 합계(공급가액 + 부가세). */
  total: z.number(),
  /** 전표 상태. */
  status: z.enum(SR_STATUS),
});

export type SalesRevenue = z.infer<typeof salesRevenueSchema>;
