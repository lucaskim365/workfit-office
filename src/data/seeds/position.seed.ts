import type { Position } from '@/domain/position/schema';

/**
 * 직급 시드 — Firebase 미설정 시 폴백 + 초기 seed.
 * rank 작을수록 상위. user.seed 의 position 문자열(관리자·파트장·반장·담당·사원)을
 * 포함하고, 조직 역할(대표·본부장·공장장·팀장)도 등재해 룰 엔진이 참조한다.
 */
export const POSITION_SEED: Position[] = [
  { id: 'P01', name: '대표', rank: 1, isDeptHead: true },
  { id: 'P02', name: '본부장', rank: 2, isDeptHead: true },
  { id: 'P03', name: '공장장', rank: 2, isDeptHead: true },
  { id: 'P04', name: '관리자', rank: 3, isDeptHead: true },
  { id: 'P05', name: '팀장', rank: 3, isDeptHead: true },
  { id: 'P06', name: '파트장', rank: 4, isDeptHead: false },
  { id: 'P07', name: '반장', rank: 5, isDeptHead: false },
  { id: 'P08', name: '담당', rank: 6, isDeptHead: false },
  { id: 'P09', name: '사원', rank: 7, isDeptHead: false },
];
