import type { StockMovement } from '@/domain/stock/schema';

/**
 * 재고 원장 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스.
 * 각 품목의 입고/불출 합이 현재고가 된다(원장→스냅샷 도출 검증).
 * (와이어프레임 wms-screens-2.jsx 현재고 수치 기준)
 */
type Seed = [type: StockMovement['type'], item: string, itemName: string, wh: string, qty: number, lot: string, reason: string, ref: string, at: string];
const rows: Seed[] = [
  ['입고', 'WF-300-B', '300mm 웨이퍼', 'A-Zone', 10000, 'LOT-RAW-8801', '정기 입고', 'REC-260601-01', '2026-06-01 09:10'],
  ['불출', 'WF-300-B', '300mm 웨이퍼', 'A-Zone', -1580, 'LOT-RAW-8801', '생산 불출', 'IS-260610-21', '2026-06-10 13:22'],
  ['입고', 'WF-200-A', '200mm 웨이퍼', 'A-Zone', 5000, 'LOT-RAW-8590', '정기 입고', 'REC-260602-04', '2026-06-02 10:40'],
  ['불출', 'WF-200-A', '200mm 웨이퍼', 'A-Zone', -1900, 'LOT-RAW-8590', '생산 불출', 'IS-260612-08', '2026-06-12 08:55'],
  ['입고', 'CHM-SL-05', '슬러리 SL-05', 'A-Zone', 200, 'LOT-CHM-0455', '정기 입고', 'REC-260603-02', '2026-06-03 11:05'],
  ['불출', 'CHM-SL-05', '슬러리 SL-05', 'A-Zone', -58, 'LOT-CHM-0455', '생산 불출', 'IS-260611-15', '2026-06-11 15:30'],
  ['입고', 'RES-PR-22', '포토레지스트', 'A-Zone', 100, 'LOT-RES-1118', '정기 입고', 'REC-260604-01', '2026-06-04 09:50'],
  ['불출', 'RES-PR-22', '포토레지스트', 'A-Zone', -62, 'LOT-RES-1118', '생산 불출', 'IS-260613-03', '2026-06-13 14:12'],
  ['입고', 'PKG-BGA-14', 'BGA 기판', 'C-Zone', 6000, 'LOT-PKG-3310', '정기 입고', 'REC-260605-06', '2026-06-05 13:18'],
  ['불출', 'PKG-BGA-14', 'BGA 기판', 'C-Zone', -800, 'LOT-PKG-3310', '생산 불출', 'IS-260614-11', '2026-06-14 10:02'],
];

export const STOCK_MOVEMENT_SEED: StockMovement[] = rows.map(([type, item, itemName, warehouse, qtyDelta, lot, reason, refDoc, at], i) => ({
  id: `MOV-${String(i + 1).padStart(4, '0')}`,
  type, item, itemName, warehouse, lot, qtyDelta, reason, refDoc, at, by: '관리자',
}));

/** 안전재고 정책(item__warehouse → 안전재고). 추후 safetyStockPolicies 컬렉션으로 이관. */
export const STOCK_SAFETY: Record<string, number> = {
  'WF-300-B__A-Zone': 5000,
  'WF-200-A__A-Zone': 4000,
  'CHM-SL-05__A-Zone': 100,
  'RES-PR-22__A-Zone': 60,
  'PKG-BGA-14__C-Zone': 2000,
};
