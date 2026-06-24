import { z } from 'zod';

/**
 * 출하(Shipment) 도메인 — 수주 라인을 출고하는 트랜잭션. 상태머신은 status.ts.
 * ([[데이터_모델_설계서.md]] salesShipments)
 */
export const SHIPMENT_STATUS = ['출고대기', '피킹중', '출고완료'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUS)[number];

export const shipmentSchema = z.object({
  no: z.string().min(1), // 출하번호(PK) DO-YYMM-NNN
  salesOrder: z.string().min(1), // 수주번호(FK→salesOrders)
  customer: z.string().default(''),
  item: z.string().min(1), // 품목코드(FK→items)
  itemName: z.string().default(''),
  qty: z.number().int().nonnegative(),
  location: z.string().default(''),
  warehouse: z.string().default('FG-Zone'),
  status: z.enum(SHIPMENT_STATUS).default('출고대기'),
});
export type Shipment = z.infer<typeof shipmentSchema>;
