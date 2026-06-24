import type { PeriodicCheck } from '@/domain/periodicCheck/schema';

/**
 * 정기 점검(Periodic Check) 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 equip-periodic-check.jsx 인라인 PC_ROWS 이관)
 * status는 result로 추론: '합격' → 완료, 그 외 → 진행.
 */
export const PERIODIC_CHECK_SEED: PeriodicCheck[] = [
  { no: 'PC-2606-018', date: '2026-06-09', eq: 'Depo 03호기', type: '월간', team: '보전 1팀', worker: '이정비', dur: '95', items: 24, ng: 0, result: '합격', next: '2026-07-09', status: '완료' },
  { no: 'PC-2606-017', date: '2026-06-09', eq: 'Implant 02호기', type: '월간', team: '보전 1팀', worker: '이정비', dur: '110', items: 28, ng: 1, result: '조건부', next: '2026-07-09', status: '진행' },
  { no: 'PC-2606-016', date: '2026-06-08', eq: 'Etch 01호기', type: '분기', team: '보전 2팀', worker: '박보전', dur: '240', items: 42, ng: 0, result: '합격', next: '2026-09-08', status: '완료' },
  { no: 'PC-2606-015', date: '2026-06-05', eq: 'Photo 05호기', type: '분기', team: '보전 2팀', worker: '박보전', dur: '210', items: 38, ng: 2, result: '불합격', next: '2026-06-12', status: '진행' },
  { no: 'PC-2606-014', date: '2026-06-04', eq: 'CMP 02호기', type: '월간', team: '보전 1팀', worker: '김설비', dur: '88', items: 24, ng: 0, result: '합격', next: '2026-07-04', status: '완료' },
  { no: 'PC-2606-013', date: '2026-06-03', eq: 'Clean 04호기', type: '월간', team: '보전 1팀', worker: '김설비', dur: '76', items: 20, ng: 0, result: '합격', next: '2026-07-03', status: '완료' },
  { no: 'PC-2606-012', date: '2026-06-02', eq: 'Thermal 05호기', type: '연간', team: '보전 2팀', worker: '박보전', dur: '480', items: 64, ng: 3, result: '조건부', next: '2027-06-02', status: '진행' },
  { no: 'PC-2606-011', date: '2026-06-01', eq: 'CMP 03호기', type: '월간', team: '보전 1팀', worker: '이정비', dur: '92', items: 24, ng: 0, result: '합격', next: '2026-07-01', status: '완료' },
];
