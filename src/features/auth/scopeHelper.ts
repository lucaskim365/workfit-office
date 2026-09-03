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
 * 1. EXEC(임원) 역할 그룹 -> 전사 스코프 (COMPANY)
 * 2. 팀장/부서장/실장/본부장 직책 -> 팀장 스코프 (LEADER)
 * 3. 그 외 (ADMIN 최고관리자 및 일반 사원) -> 개인 스코프 (PERSONAL)
 */
export function resolveUserScope(user?: User | null, userRoles: string[] = []): UserDataScope {
  if (!user) return 'PERSONAL';

  const isExec = userRoles.includes('EXEC') || user.roleGroup === 'EXEC';
  if (isExec) {
    return 'COMPANY';
  }

  if (isLeaderPosition(user.position, user.jobTitle)) {
    return 'LEADER';
  }

  return 'PERSONAL';
}

/**
 * 업무계획 화면에서 특정 대상자의 업무계획을 조회할 수 있는지 판정합니다.
 */
export function canViewWorkPlan(
  actor: User,
  target: User,
  actorScope: UserDataScope
): boolean {
  if (actorScope === 'COMPANY') return true;

  if (actorScope === 'LEADER') {
    // 1. 본인 소속 부서원 전체 열람 가능
    if (target.dept && actor.dept && target.dept === actor.dept) {
      return true;
    }
    // 2. 타 부서 팀장들의 업무계획도 열람 가능
    if (isLeaderPosition(target.position, target.jobTitle)) {
      return true;
    }
    return false;
  }

  // PERSONAL: 오직 본인만 열람 가능
  return target.id === actor.id;
}
