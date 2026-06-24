import type { BmAction } from '@/domain/bmAction/schema';

/**
 * 사후보전(BM) 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 equip-bm.jsx 인라인 BM_ROWS 이관)
 */
export const BM_ACTION_SEED: BmAction[] = [
  { no: 'BM-2606-031', eq: 'Thermal 05호기', sym: '히터존 3 온도 미상승', cause: '히터 단선', date: '06-10 08:42', worker: '박보전', team: '보전 2팀', down: 95, sev: '중대', state: '수리중', parts: 1, cost: 1850000 },
  { no: 'BM-2606-030', eq: 'CMP 02호기', sym: '구동부 이상 진동', cause: '베어링 마모', date: '06-10 06:15', worker: '김설비', team: '보전 1팀', down: 0, sev: '경미', state: '진단중', parts: 0, cost: 0 },
  { no: 'BM-2606-029', eq: 'Etch 01호기', sym: 'RF 파워 불안정', cause: '매칭 네트워크 불량', date: '06-09 22:30', worker: '박보전', team: '보전 2팀', down: 142, sev: '중대', state: '완료', parts: 2, cost: 3200000 },
  { no: 'BM-2606-028', eq: 'Implant 02호기', sym: '이온빔 전류 저하', cause: '필라멘트 수명', date: '06-09 14:05', worker: '이정비', team: '보전 1팀', down: 88, sev: '중대', state: '완료', parts: 1, cost: 2400000 },
  { no: 'BM-2606-027', eq: 'Photo 05호기', sym: '스테이지 정렬 오차', cause: 'XY 모터 엔코더 노이즈', date: '06-08 11:20', worker: '김설비', team: '보전 1팀', down: 56, sev: '주의', state: '완료', parts: 1, cost: 780000 },
  { no: 'BM-2606-026', eq: 'Depo 03호기', sym: '챔버 압력 누설', cause: 'O-ring 경화', date: '06-07 09:50', worker: '이정비', team: '보전 1팀', down: 38, sev: '주의', state: '완료', parts: 3, cost: 420000 },
  { no: 'BM-2606-025', eq: 'Clean 04호기', sym: '케미컬 공급 불량', cause: '펌프 다이어프램 손상', date: '06-06 16:40', worker: '박보전', team: '보전 2팀', down: 64, sev: '주의', state: '완료', parts: 1, cost: 650000 },
];
