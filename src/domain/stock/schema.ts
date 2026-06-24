import { z } from 'zod';

/**
 * 재고 원장(stockMovements) + 현재고 스냅샷(stocks) 도메인.
 * ★ MES 정합성 핵심: 모든 수량 변동은 원장에 1건씩 기록하고,
 *   현재고(stocks)는 원장에서 도출(derive)되는 파생값이다.
 * ([[데이터_모델_설계서.md]] §2.6 / [[DB_이관_대비_설계원칙.md]])
 */
export const MOVEMENT_TYPES = ['입고', '생산입고', '불출', '이송', '조정', '반품', '폐기', '실사'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const STOCK_STATUS = ['정상', '부족', '과다'] as const;
export type StockStatus = (typeof STOCK_STATUS)[number];

export const stockMovementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(MOVEMENT_TYPES),
  item: z.string().min(1), // 품목코드(FK→items)
  itemName: z.string().default(''), // 표시용 denormalize
  warehouse: z.string().min(1),
  lot: z.string().default(''),
  /** 수량 증감(±). 입고/반품 +, 불출/폐기 −, 조정·실사 ±. */
  qtyDelta: z.number().int(),
  reason: z.string().default(''),
  refDoc: z.string().default(''), // 근거 전표(FK)
  at: z.string().default(''), // ISO 문자열
  by: z.string().default(''),
});
export type StockMovement = z.infer<typeof stockMovementSchema>;

export const stockSchema = z.object({
  item: z.string(),
  itemName: z.string(),
  warehouse: z.string(),
  currentQty: z.number().int(),
  safetyStock: z.number().int().nonnegative(),
  status: z.enum(STOCK_STATUS),
});
export type Stock = z.infer<typeof stockSchema>;

/** 안전재고 대비 상태 판정(과다 = 안전재고 2.5배 이상). */
export function stockStatus(qty: number, safe: number): StockStatus {
  if (safe > 0 && qty < safe) return '부족';
  if (safe > 0 && qty >= safe * 2.5) return '과다';
  return '정상';
}

/**
 * 원장 → 현재고 스냅샷 도출(순수 함수).
 * 운영 시에는 함수/트리거가 stocks 컬렉션을 유지하지만, 로직은 동일하다.
 */
export function deriveStocks(
  movements: StockMovement[],
  safetyOf: (item: string, warehouse: string) => number,
): Stock[] {
  const map = new Map<string, Stock>();
  for (const m of movements) {
    const key = `${m.item}__${m.warehouse}`;
    let s = map.get(key);
    if (!s) {
      s = { item: m.item, itemName: m.itemName, warehouse: m.warehouse, currentQty: 0, safetyStock: safetyOf(m.item, m.warehouse), status: '정상' };
      map.set(key, s);
    }
    s.currentQty += m.qtyDelta;
    if (m.itemName && !s.itemName) s.itemName = m.itemName;
  }
  for (const s of map.values()) s.status = stockStatus(s.currentQty, s.safetyStock);
  return [...map.values()];
}
