import type { LotSplit } from '@/domain/lotSplit/schema';

/**
 * LOT 분할/병합 이력 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-4.jsx 의 인라인 HIST mock 이관)
 */
export const LOT_SPLIT_SEED: LotSplit[] = [
  { id: 'LS-01', type: '분할', srcLot: 'LOT-RAW-8821', resultLots: 'LOT-RAW-8821-A/B/C', qty: '500 → 200·200·100', who: '김현우', date: '06-11 09:24' },
  { id: 'LS-02', type: '병합', srcLot: 'LOT-CHM-0457-1/2', resultLots: 'LOT-CHM-0457-M', qty: '20·15 → 35', who: '이서연', date: '06-11 10:02' },
  { id: 'LS-03', type: '분할', srcLot: 'LOT-PKG-3320', resultLots: 'LOT-PKG-3320-A/B', qty: '500 → 300·200', who: '박준호', date: '06-10 16:40' },
];
