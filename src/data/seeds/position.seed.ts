import type { Position } from '@/domain/position/schema';

/**
 * 직급 시드 — Firebase 미설정 시 폴백 + 초기 seed.
 * rank 작을수록 상위. Workfit Office 실제 조직도의 직급 체계.
 * 팀장/본부장 등 '직책'은 부서 headUserId 로 표현하고, 여기엔 '직급'만 등재한다.
 * user.seed 의 position 문자열과 매칭되며, 동적 결재선 룰 엔진의 직급 서열 비교에 사용.
 */
export const POSITION_SEED: Position[] = [
  { id: 'P01', name: '대표이사', rank: 1, isDeptHead: true },
  { id: 'P02', name: '상무이사', rank: 2, isDeptHead: true },
  { id: 'P03', name: '이사', rank: 3, isDeptHead: true },
  { id: 'P04', name: '소장', rank: 3, isDeptHead: true },
  { id: 'P05', name: '부장', rank: 4, isDeptHead: false },
  { id: 'P06', name: '차장', rank: 5, isDeptHead: false },
  { id: 'P07', name: '과장', rank: 6, isDeptHead: false },
  { id: 'P08', name: '대리', rank: 7, isDeptHead: false },
  { id: 'P09', name: '연구원', rank: 8, isDeptHead: false },
  { id: 'P10', name: '사원', rank: 9, isDeptHead: false },
];
