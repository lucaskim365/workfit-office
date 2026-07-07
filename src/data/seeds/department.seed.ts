import type { Department } from '@/domain/department/schema';

/**
 * 부서 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스.
 * 본부(최상위) 5개 + 하위 팀 7개. 팀명은 user.seed 의 dept 문자열과 일치.
 * headUserId 는 팀장/대표 역할 사용자(전결·합의 라우팅에 사용).
 */
export const DEPARTMENT_SEED: Department[] = [
  // 본부(최상위) — 생산본부는 공장 조직(공장장=headUserId U008)
  { id: 'D100', name: '경영지원본부', parentId: null, headUserId: 'U001', deptType: '본사', order: 1 },
  { id: 'D200', name: '생산본부', parentId: null, headUserId: 'U008', deptType: '공장', order: 2 },
  { id: 'D300', name: '품질본부', parentId: null, headUserId: 'U007', deptType: '본사', order: 3 },
  { id: 'D400', name: '설비본부', parentId: null, headUserId: 'U006', deptType: '공장', order: 4 },
  { id: 'D500', name: '자재본부', parentId: null, headUserId: 'U012', deptType: '본사', order: 5 },
  // 팀(하위) — name 은 users.dept 와 매칭. 생산·설비 산하 팀은 공장 소속
  { id: 'D110', name: '시스템관리팀', parentId: 'D100', headUserId: 'U001', deptType: '본사', order: 1 },
  { id: 'D210', name: '생산1팀', parentId: 'D200', headUserId: 'U008', deptType: '공장', order: 1 },
  { id: 'D220', name: '생산2팀', parentId: 'D200', headUserId: 'U004', deptType: '공장', order: 2 },
  { id: 'D230', name: '현장관리팀', parentId: 'D200', headUserId: 'U005', deptType: '공장', order: 3 },
  { id: 'D310', name: '품질보증팀', parentId: 'D300', headUserId: 'U007', deptType: '본사', order: 1 },
  { id: 'D410', name: '설비보전팀', parentId: 'D400', headUserId: 'U006', deptType: '공장', order: 1 },
  { id: 'D510', name: '자재관리팀', parentId: 'D500', headUserId: 'U012', deptType: '본사', order: 1 },
];
