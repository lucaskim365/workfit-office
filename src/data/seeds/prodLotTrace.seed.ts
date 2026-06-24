import type { ProdLotTrace } from '@/domain/prodLotTrace/schema';

/**
 * 생산 LOT 추적(투입자재) 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 prod-screens-2.LotTraceContent 의 인라인 MATS 이관, id 결정적 부여)
 */
export const PROD_LOT_TRACE_SEED: ProdLotTrace[] = [
  { id: 'LT-01', mat: 'WF-300-B', name: '300mm 웨이퍼', lot: 'LOT-RAW-8821', vendor: '대성반도체' },
  { id: 'LT-02', mat: 'RES-PR-22', name: '포토레지스트', lot: 'LOT-RES-1120', vendor: '한울케미칼' },
  { id: 'LT-03', mat: 'CHM-SL-05', name: '슬러리 SL-05', lot: 'LOT-CHM-0457', vendor: 'JS머트리얼' },
  { id: 'LT-04', mat: 'CHM-GAS-02', name: '공정 가스', lot: 'LOT-GAS-0099', vendor: '대한가스' },
];
