import { z } from 'zod';

/**
 * 구매 입고(Receipt) 도메인 — PO 대비 입고. 입고상태는 수량에서 도출(파생).
 * ([[데이터_모델_설계서.md]] receipts)
 */
export const RECEIPT_STATUS = ['입고대기', '부분입고', '입고완료'] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUS)[number];

export const receiptSchema = z.object({
  po: z.string().min(1), // PO번호(PK, ERP)
  item: z.string().min(1), // 품목코드(FK→items)
  itemName: z.string().default(''),
  vendor: z.string().default(''), // 협력사(FK→vendors)
  poQty: z.number().int().nonnegative(),
  recvQty: z.number().int().nonnegative().default(0),
  warehouse: z.string().default('A-Zone'),
});
export type Receipt = z.infer<typeof receiptSchema>;

/** 입고상태 도출 — 0=입고대기, PO수량 이상=입고완료, 그 외 부분입고. */
export function receiptStatus(r: Receipt): ReceiptStatus {
  if (r.recvQty <= 0) return '입고대기';
  if (r.recvQty >= r.poQty) return '입고완료';
  return '부분입고';
}
