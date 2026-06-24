import type { PutawayTask } from '@/domain/putawayTask/schema';

/**
 * 입고 적치 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens.jsx 의 인라인 ROWS 이관)
 */
export const PUTAWAY_TASK_SEED: PutawayTask[] = [
  { lot: 'LOT-RAW-8821', code: 'WF-300-B', from: '입고장', to: 'A-1-2-1', unit: 'Pallet', status: '대기' },
  { lot: 'LOT-RAW-8822', code: 'WF-300-B', from: '입고장', to: 'A-1-2-2', unit: 'Pallet', status: '대기' },
  { lot: 'LOT-CHM-0457', code: 'CHM-SL-05', from: '입고장', to: 'A-3-1-4', unit: 'Box', status: '완료' },
  { lot: 'LOT-PKG-3320', code: 'PKG-BGA-14', from: '입고장', to: 'C-2-1-1', unit: 'Pallet', status: '진행' },
];
