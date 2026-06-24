import type { WipStatus } from '@/domain/wipStatus/schema';

/**
 * 재공 현황 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 prod-screens.WipContent 의 인라인 ROWS 이관, id 결정적 부여)
 */
export const WIP_STATUS_SEED: WipStatus[] = [
  { id: 'WIP-01', lot: 'LOT-A2301', item: 'WF-300-B', proc: 'OP-30 식각', eq: 'ETCH01', qty: 480, elapsed: '2h 12m', status: '정상' },
  { id: 'WIP-02', lot: 'LOT-A2302', item: 'WF-300-B', proc: 'OP-50 CMP', eq: 'CMP02', qty: 500, elapsed: '0h 48m', status: '정상' },
  { id: 'WIP-03', lot: 'LOT-B5510', item: 'PKG-BGA-14', proc: 'OP-40 증착', eq: 'DEP03', qty: 320, elapsed: '4h 35m', status: '지연' },
  { id: 'WIP-04', lot: 'LOT-C7720', item: 'MOD-CAM-02', proc: 'OP-20 포토', eq: 'PHO05', qty: 180, elapsed: '1h 05m', status: '정상' },
  { id: 'WIP-05', lot: 'LOT-A2298', item: 'WF-200-A', proc: 'OP-60 검사', eq: 'INS-VIS', qty: 410, elapsed: '5h 50m', status: '병목' },
];
