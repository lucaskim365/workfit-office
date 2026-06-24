import type { LabelTask } from '@/domain/labelTask/schema';

/**
 * 라벨 발행 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens.jsx 의 인라인 ROWS 이관)
 */
export const LABEL_TASK_SEED: LabelTask[] = [
  { lot: 'LOT-RAW-8821', code: 'WF-300-B', unit: 'Pallet', qty: '500', labelType: 'RFID', status: '발행완료' },
  { lot: 'LOT-RAW-8822', code: 'WF-300-B', unit: 'Pallet', qty: '500', labelType: 'RFID', status: '발행완료' },
  { lot: 'LOT-CHM-0457', code: 'CHM-SL-05', unit: 'Box', qty: '20', labelType: '바코드', status: '발행완료' },
  { lot: 'LOT-RES-1120', code: 'RES-PR-22', unit: 'Box', qty: '10', labelType: '바코드', status: '대기' },
];
