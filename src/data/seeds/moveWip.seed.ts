import type { MoveWip } from '@/domain/moveWip/schema';

/**
 * 공정이동 재공 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 move.jsx 의 인라인 mock(WIP) 이관)
 */
export const MOVE_WIP_SEED: MoveWip[] = [
  { lot: 'LOT-2606-A12', name: '커넥터 하우징', cur: 'OP10 사출성형', next: 'OP20 디버링/검사', qty: 4800, good: 4760, bad: 40, wait: 0.4 },
  { lot: 'LOT-2606-B07', name: '터미널 핀', cur: 'OP30 터미널압착', next: 'OP40 본체조립', qty: 12000, good: 11940, bad: 60, wait: 1.2 },
  { lot: 'LOT-2606-C03', name: '커넥터 어셈블리', cur: 'OP40 본체조립', next: 'OP50 기능검사', qty: 2400, good: 2376, bad: 24, wait: 2.6 },
  { lot: 'LOT-2606-D09', name: '센서 모듈 PCB', cur: 'OP10 SMT실장', next: 'OP20 리플로우', qty: 5400, good: 5360, bad: 40, wait: 0.2 },
  { lot: 'LOT-2606-E02', name: '센서 모듈', cur: 'OP50 기능검사', next: '입고 / 완료', qty: 1480, good: 1452, bad: 28, wait: 3.1 },
];
