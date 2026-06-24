import type { MaterialLoad } from '@/domain/materialLoad/schema';

/**
 * 자재 투입 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 prod-screens-2.MaterialLoadContent 의 인라인 ROWS 이관)
 */
export const MATERIAL_LOAD_SEED: MaterialLoad[] = [
  { id: 'ML-01', mat: 'WF-300-B', name: '300mm 웨이퍼', lot: 'LOT-RAW-8821', req: '2,500', actual: '2,480', state: '정상' },
  { id: 'ML-02', mat: 'CHM-SL-05', name: '슬러리 SL-05', lot: 'LOT-CHM-0457', req: '40', actual: '38', state: '정상' },
  { id: 'ML-03', mat: 'RES-PR-22', name: '포토레지스트', lot: 'LOT-RES-1120', req: '20', actual: '20', state: '정상' },
  { id: 'ML-04', mat: 'CHM-GAS-02', name: '공정 가스', lot: 'LOT-GAS-0099', req: '15', actual: '17', state: '초과' },
];
