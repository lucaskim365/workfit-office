import { z } from 'zod';

/**
 * 수주(SalesOrder) 도메인 — header-line + 파생 납품상태.
 * 납품상태(미납/부분납품/완납)는 임의 전이가 아니라 라인 납품수량에서 도출한다.
 * ([[데이터_모델_설계서.md]] salesOrders / salesOrderLines)
 */
export const DELIVERY_STATUS = ['미납', '부분납품', '완납'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUS)[number];

export const salesOrderLineSchema = z.object({
  code: z.string().min(1), // 품목코드(FK→items)
  name: z.string().default(''),
  qty: z.number().int().nonnegative(), // 수주량
  price: z.number().int().nonnegative(), // 공급단가(원)
  due: z.string().default(''), // 납기일
  deliveredQty: z.number().int().nonnegative().default(0), // 누적 납품량
});
export type SalesOrderLine = z.infer<typeof salesOrderLineSchema>;

export const salesOrderSchema = z.object({
  no: z.string().min(1), // 수주번호(PK) SO-YYMM-NNN
  customer: z.string().min(1), // 거래처(FK→vendors)
  orderDate: z.string().default(''),
  reqDeliveryDate: z.string().default(''),
  paymentTerms: z.string().default(''),
  salesperson: z.string().default(''),
  lines: z.array(salesOrderLineSchema).default([]),
});
export type SalesOrder = z.infer<typeof salesOrderSchema>;

export interface OrderTotals {
  ordered: number;
  delivered: number;
  pending: number;
  amount: number; // 공급가액 합계
}

/** 라인 집계(수주량/납품량/미납량/공급가액). 순수 함수. */
export function orderTotals(o: SalesOrder): OrderTotals {
  const ordered = o.lines.reduce((s, l) => s + l.qty, 0);
  const delivered = o.lines.reduce((s, l) => s + l.deliveredQty, 0);
  const amount = o.lines.reduce((s, l) => s + l.qty * l.price, 0);
  return { ordered, delivered, pending: Math.max(ordered - delivered, 0), amount };
}

/** 납품상태 도출 — 납품량 0=미납, 수주량 이상=완납, 그 외 부분납품. */
export function deliveryStatus(o: SalesOrder): DeliveryStatus {
  const { ordered, delivered } = orderTotals(o);
  if (delivered <= 0) return '미납';
  if (delivered >= ordered) return '완납';
  return '부분납품';
}
