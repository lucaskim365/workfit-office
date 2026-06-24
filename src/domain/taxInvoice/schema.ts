import { z } from 'zod';

/**
 * 세금계산서 taxInvoices. PK=no.
 *
 * 세금계산서/거래명세서(TaxInvoice) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 매출 전표 기반 증빙 발행 내역. 폼 검증·Firestore 검증·타입을 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 와이어프레임 sales-screens.jsx 의 인라인 ROWS 이관.
 */
export const taxInvoiceSchema = z.object({
  /** 증빙번호(PK). 예: TI-2606-072. */
  no: z.string().min(1, '증빙번호는 필수입니다'),
  /** 연계 매출번호(salesOrders/매출 전표 참조). */
  sale: z.string().min(1, '매출번호는 필수입니다'),
  /** 거래처명. */
  cust: z.string().min(1, '거래처는 필수입니다'),
  /** 증빙 종류 — 전자세금계산서 / 거래명세서 등. */
  type: z.string().min(1, '증빙 종류는 필수입니다'),
  /** 합계금액(원). */
  amt: z.number(),
  /** 발행일(YYYY-MM-DD). */
  date: z.string().default(''),
  /** 발행상태 — 발행완료 / 발행대기 등. */
  status: z.string().min(1, '발행상태는 필수입니다'),
  /** 국세청 전송 상태 — 국세청 전송 / '—'. */
  nts: z.string().default('—'),
});

export type TaxInvoice = z.infer<typeof taxInvoiceSchema>;
