import type { GageRr } from '@/domain/gageRr/schema';

/**
 * Gage R&R(MSA) 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 qual-gage-rr.jsx 의 인라인 mock MSA_LIST 이관)
 */
export const GAGE_RR_SEED: GageRr[] = [
  { id: 'MSA-2603-01', gage: '3차원 측정기(CMM)', gid: 'QG-CMM-01', char: '외경(O.D)', unit: 'mm', method: 'ANOVA', ops: 3, parts: 10, trials: 3, ev: 0.05, av: 0.03, pv: 0.83, tol: 0.1, date: '2026-03' },
  { id: 'MSA-2602-02', gage: '영상 측정 시스템', gid: 'QG-VIS-02', char: '핀 피치', unit: 'mm', method: 'ANOVA', ops: 3, parts: 10, trials: 2, ev: 0.07, av: 0.05, pv: 0.92, tol: 0.1, date: '2026-02' },
  { id: 'MSA-2601-03', gage: '로크웰 경도계', gid: 'QG-HRC-03', char: '표면 경도', unit: 'HRC', method: '평균-범위', ops: 3, parts: 10, trials: 3, ev: 0.1, av: 0.07, pv: 0.95, tol: 4.0, date: '2026-01' },
  { id: 'MSA-2512-04', gage: '윤곽 투영기', gid: 'QG-PRO-06', char: '치형(M)', unit: 'mm', method: '평균-범위', ops: 2, parts: 10, trials: 3, ev: 0.12, av: 0.09, pv: 0.98, tol: 0.02, date: '2025-12' },
  { id: 'MSA-2511-05', gage: '영상 측정 시스템 #2', gid: 'QG-VIS-07', char: '소형 부품 치수', unit: 'mm', method: 'ANOVA', ops: 3, parts: 10, trials: 2, ev: 0.28, av: 0.18, pv: 0.95, tol: 0.05, date: '2025-11' },
];
