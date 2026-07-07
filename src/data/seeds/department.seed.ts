import type { Department } from '@/domain/department/schema';

/**
 * 부서 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스.
 * Workfit Office 실제 조직도(대표이사 → AX Committee / 대표이사 직속 / AX사업본부 → 산하 팀).
 * name 은 user.seed 의 dept 문자열과 정확히 일치. headUserId 는 부서장(팀장/본부장) 역할
 * 사용자로 합의·전결 라우팅에 사용. 조직도 상 '충원(공석)' 자리는 실명자 미등록으로 제외.
 */
export const DEPARTMENT_SEED: Department[] = [
  // 최상위 — 대표이사(박영미)
  { id: 'D100', name: '대표이사', parentId: null, headUserId: 'U001', deptType: '본사', order: 1 },
  // 대표이사 직속 · 위원회 · 사업본부(대표이사 산하)
  { id: 'D110', name: '대표이사 직속', parentId: 'D100', headUserId: 'U002', deptType: '본사', order: 1 },
  { id: 'D120', name: 'AX Committee', parentId: 'D100', headUserId: 'U004', deptType: '기타', order: 2 },
  { id: 'D200', name: 'AX사업본부', parentId: 'D100', headUserId: 'U003', deptType: '본사', order: 3 },
  // AX사업본부 산하 팀
  { id: 'D210', name: '품질관리팀', parentId: 'D200', headUserId: 'U006', deptType: '본사', order: 1 },
  { id: 'D220', name: '영업팀', parentId: 'D200', headUserId: 'U008', deptType: '영업소', order: 2 },
  { id: 'D230', name: '사업관리팀', parentId: 'D200', headUserId: 'U009', deptType: '본사', order: 3 },
  { id: 'D240', name: 'S/W 개발팀', parentId: 'D200', headUserId: 'U011', deptType: '본사', order: 4 },
  { id: 'D250', name: '부설기술연구소', parentId: 'D200', headUserId: null, deptType: '연구소', order: 5 },
];
