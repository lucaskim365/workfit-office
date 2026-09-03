import type { RoleGroup } from '@/domain/roleGroup/schema';

export interface UserIdent {
  id: string;
  empNo?: string;
  name?: string;
  dept?: string;
  position?: string;
  status?: string;
}

export interface OrgContext {
  depts?: Array<{ id: string; name: string }>;
  positions?: Array<{ name: string; rank: number }>;
}

/**
 * 사용자 정보와 roleGroups 컬렉션(SSOT)을 기반으로 해당 사용자가 속한 모든 활성 역할 그룹을 탐색합니다.
 */
export function resolveUserRoles(
  user: UserIdent | null | undefined,
  groups: RoleGroup[] = [],
  org?: OrgContext
): RoleGroup[] {
  if (!user || user.status === '미사용') return [];

  const userDeptId = org?.depts?.find(
    (d) => d.name === user.dept || d.id === (user as any).deptId || d.id === user.dept
  )?.id ?? null;

  const userPosRank = org?.positions?.find((p) => p.name === user.position)?.rank ?? null;

  // 1) 최고 관리자(ADMIN) 여부 판정
  const adminGroup = groups.find(
    (g) => (g.code === 'ADMIN' || g.code === 'ROLE_ADMIN') && g.use
  );
  let isSuperAdmin = false;
  if (adminGroup) {
    if (adminGroup.userIds?.includes(user.id) || (user.empNo && adminGroup.userIds?.includes(user.empNo))) {
      isSuperAdmin = true;
    } else if (userDeptId && adminGroup.deptIds?.includes(userDeptId)) {
      isSuperAdmin = true;
    } else if (userPosRank != null && adminGroup.positionRanks?.includes(userPosRank)) {
      isSuperAdmin = true;
    } else if (adminGroup.members?.some((m) => m.code === user.id || (user.empNo && m.code === user.empNo) || m.name === user.name)) {
      isSuperAdmin = true;
    }
  }

  // 2) 매칭되는 모든 역할 그룹 필터링
  return groups.filter((g) => {
    if (!g.use) return false;
    const normCode = g.code.replace(/^ROLE_/, '').toUpperCase();

    // 일반사원(USER) 그룹은 활성화된 모든 로그인 임직원에게 기본 부여
    if (normCode === 'USER') return true;

    // 최고 관리자일 경우
    if (normCode === 'ADMIN' && isSuperAdmin) return true;

    // 개별 사원 ID / 사번 바인딩
    if (g.userIds && (g.userIds.includes(user.id) || (user.empNo && g.userIds.includes(user.empNo)))) {
      return true;
    }

    // 부서 단위 바인딩
    if (userDeptId && g.deptIds && g.deptIds.includes(userDeptId)) {
      return true;
    }

    // 직급 단위 바인딩
    if (userPosRank != null && g.positionRanks && g.positionRanks.includes(userPosRank)) {
      return true;
    }

    // 레거시 members 배열
    if (g.members && g.members.some((m) => m.code === user.id || (user.empNo && m.code === user.empNo) || m.name === user.name)) {
      return true;
    }

    return false;
  });
}

/**
 * 사용자가 부여받은 모든 역할의 한글 명칭 목록을 반환합니다. (예: ['최고관리자'] or ['일반사원', '재무담당자'])
 */
export function resolveUserRoleNames(
  user: UserIdent | null | undefined,
  groups: RoleGroup[] = [],
  org?: OrgContext
): string[] {
  const matched = resolveUserRoles(user, groups, org);
  if (matched.length === 0) return ['일반사원'];
  return matched.map((g) => g.name || g.code);
}
