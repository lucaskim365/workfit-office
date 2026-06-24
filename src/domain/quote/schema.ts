import { z } from 'zod';

/**
 * 영업 견적(Quote) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 영업 견적 quotes. PK=no.
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 */
export const quoteSchema = z.object({
  /** 견적번호(PK). 예: QT-2606-041 */
  no: z.string().min(1, '견적번호는 필수입니다'),
  /** 거래처명. */
  cust: z.string().min(1, '거래처는 필수입니다'),
  /** 견적 품목 요약. */
  item: z.string().default(''),
  /** 수량. */
  qty: z.number(),
  /** 견적금액(천단위 콤마 포함 문자열). */
  amt: z.string().default(''),
  /** 발송 상태. 예: 발송 / 작성중 */
  sent: z.string().default(''),
  /** 진행 상태. 예: 검토중 / 수주전환 / 실주 / — */
  progress: z.string().default(''),
});

export type Quote = z.infer<typeof quoteSchema>;
