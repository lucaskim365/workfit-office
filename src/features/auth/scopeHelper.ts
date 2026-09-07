import type { User } from '@/domain/user/schema';

export type UserDataScope = 'PERSONAL' | 'LEADER' | 'COMPANY';

const LEADER_TITLES = ['팀장', '부서장', '파트장', '실장', '본부장', '그룹장', '센터장', '지사장'];

/**
 * 직책/직급 텍스트로부터 팀장급 이상 직책 여부를 판별합니다.
 */
export function isLeaderPosition(position?: string | null, jobTitle?: string | null): boolean {
  const p = (position ?? '').trim();
  const j = (jobTitle ?? '').trim();
  return LEADER_TITLES.some((title) => p.includes(title) || j.includes(title));
}

/**
 * 사용자의 역할 그룹과 직책을 종합하여 데이터 조회 스코프를 결정합니다.
 * 
 * 규칙:
 * 1. EXEC(임원) / ADMIN(관리자) 역할 그룹 -> 전사 스코프 (COMPANY)
 * 2. 팀장/부서장/실장/본부장 직책 -> 팀장 스코프 (LEADER)
 * 3. 그 외 (일반 사원) -> 부서/팀 스코프 (PERSONAL - 동일 부서 팀원 및 리더 열람 가능)
 */
export function resolveUserScope(user?: User | null, userRoles: string[] = []): UserDataScope {
  if (!user) return 'PERSONAL';

  const isCompanyScope = userRoles.includes('EXEC') || userRoles.includes('ADMIN');
  if (isCompanyScope) {
    return 'COMPANY';
  }

  if (isLeaderPosition(user.position, user.jobTitle)) {
    return 'LEADER';
  }

  return 'PERSONAL';
}

/**
 * 업무계획 화면에서 특정 대상자의 업무계획을 조회할 수 있는지 판정합니다.
 * 
 * 1. 전사/관리자/임원: 전사 임직원 업무계획 열람 가능
 * 2. 동일 부서 소속 팀원: 상호 간 업무계획 열람 가능 (팀원끼리 업무계획 공유 및 협업)
 * 3. 타 부서 팀장/임원(회의 일정/리더 계획): 타 부서 리더의 업무계획 열람 가능
 */
export function canViewWorkPlan(
  actor: User,
  target: User,
  actorScope: UserDataScope
): boolean {
  if (actorScope === 'COMPANY') return true;

  // 1. 본인 업무계획은 항상 열람 가능
  if (target.id === actor.id) return true;

  // 2. 같은 부서 소속 팀원 간 상호 열람 허용 (팀원끼리 업무계획 확인 로직)
  if (target.dept && actor.dept && target.dept === actor.dept) {
    return true;
  }

  // 3. 팀장(LEADER) 스코프인 경우에만 타 부서 팀장/임원 업무계획 열람 허용 (회의 일정 공유)
  if (actorScope === 'LEADER') {
    return isLeaderPosition(target.position, target.jobTitle);
  }

  // 4. 일반 사원(PERSONAL): 오직 본인 소속 부서 팀원들만 열람 가능 (타 부서 인원 일체 비노출)
  return false;
}
