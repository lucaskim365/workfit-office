import type { PickingList } from '@/domain/pickingList/schema';

/**
 * 피킹 리스트 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (MatPickingScreen.tsx 의 인라인 ROWS 이관 — 7컬럼 객체화 + 결정적 id 부여)
 */
export const PICKING_LIST_SEED: PickingList[] = [
  { id: 'PK-01', seq: '1', code: 'WF-300-B', lot: 'LOT-RAW-8810', loc: 'A-1-1-1', inDate: '2026-05-20', qty: '2,500', rule: 'FIFO' },
  { id: 'PK-02', seq: '2', code: 'CHM-SL-05', lot: 'LOT-CHM-0440', loc: 'A-3-1-1', inDate: '2026-05-28', qty: '40', rule: 'FIFO' },
  { id: 'PK-03', seq: '3', code: 'RES-PR-22', lot: 'LOT-RES-1102', loc: 'A-3-2-2', inDate: '2026-06-01', qty: '20', rule: 'FIFO' },
];
