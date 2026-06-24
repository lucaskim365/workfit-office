import type { AgingStock } from '@/domain/agingStock/schema';

/**
 * 장기재고/유효기간 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-3.jsx 의 인라인 ROWS 이관)
 */
export const AGING_STOCK_SEED: AgingStock[] = [
  { lot: 'LOT-RES-1102', code: 'RES-PR-22', name: '포토레지스트', expiry: '2026-06-15', days: 4 },
  { lot: 'LOT-CHM-0440', code: 'CHM-SL-05', name: '슬러리 SL-05', expiry: '2026-06-20', days: 9 },
  { lot: 'LOT-CHM-0099', code: 'CHM-GAS-02', name: '공정 가스', expiry: '2026-06-12', days: 1 },
  { lot: 'LOT-RES-1120', code: 'RES-PR-22', name: '포토레지스트', expiry: '2026-07-10', days: 29 },
  { lot: 'LOT-CHM-0457', code: 'CHM-SL-05', name: '슬러리 SL-05', expiry: '2026-08-01', days: 51 },
];
