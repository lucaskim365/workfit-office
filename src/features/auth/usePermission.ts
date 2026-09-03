import { useMemo, useCallback } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useRoleGroups } from '@/features/roleGroup/useRoleGroups';
import type { RoleGroup, ActionPermission } from '@/domain/roleGroup/schema';

/**
 * 전사 통합 권한 판정 훅 (usePermission)
 * - 사용자 계정(ID, dept, position, roleGroup)과 활성화된 역할그룹(roleGroups)을 결합
 * - 1인 다중 권한 그룹 소속 지원 & 포용적 합집합(OR Rule)으로 최종 권한을 실시간 계산
 * - 최고 관리자(SUPER_ADMIN) 바이패스 및 100% 무중단 하위 호환 지원
 */
export function usePermission() {
  const { user } = useAuth();
  const org = useOrgTree();
  const { data: groups = [], isLoading: isGroupsLoading } = useRoleGroups() as {
    data: RoleGroup[] | undefined;
    isLoading: boolean;
  };

  /** 현재 사용자의 부서 ID & 직급 Rank */
  const userDeptId = useMemo(() => {
    if (!user) return null;
    return org.depts.find((d) => d.name === user.dept || d.id === (user as any).deptId || d.id === user.dept)?.id ?? null;
  }, [org.depts, user?.dept, (user as any)?.deptId]);

  const userPosRank = useMemo(() => {
    if (!user?.position) return null;
    return org.positions.find((p) => p.name === user.position)?.rank ?? null;
  }, [org.positions, user?.position]);

  /** 최고 관리자 여부 판정 (순수 DB roleMappings 및 그룹 설정 기반) */
  const isSuperAdmin = useMemo(() => {
    if (!user) return false;
    if (user.roleGroup === 'ADMIN') return true;
    const adminGroup = groups.find((g) => g.code === 'ADMIN' && g.use);
    if (adminGroup) {
      if (adminGroup.userIds?.includes(user.id)) return true;
      if (userDeptId && adminGroup.deptIds?.includes(userDeptId)) return true;
      if (userPosRank != null && adminGroup.positionRanks?.includes(userPosRank)) return true;
    }
    return false;
  }, [user, groups, userDeptId, userPosRank]);

  /** 현재 사용자가 속한 모든 활성 권한 그룹 (다중 소속 합산) */
  const myGroups = useMemo(() => {
    if (!user) return [];
    return groups.filter((g) => {
      if (!g.use) return false;
      // 0) 일반사원(USER) 그룹은 활성화된 모든 로그인 임직원에게 기본 상시 부여 (전사 기본 권한 베이스라인)
      if (g.code === 'USER') return true;
      // 1) 최고 관리자일 경우
      if (g.code === 'ADMIN' && isSuperAdmin) return true;
      // 2) 레거시 기본 roleGroup 매핑 (ADMIN, OPERATOR, USER)
      if (g.code === user.roleGroup) return true;
      // 3) 개별 사원 ID 바인딩
      if (g.userIds && g.userIds.includes(user.id)) return true;
      // 4) 부서 단위 바인딩
      if (userDeptId && g.deptIds && g.deptIds.includes(userDeptId)) return true;
      // 5) 직급 단위 바인딩
      if (userPosRank != null && g.positionRanks && g.positionRanks.includes(userPosRank)) return true;
      // 6) 레거시 members 배열 지원
      if (g.members && g.members.some((m) => m.code === user.id || m.name === user.name)) return true;
      return false;
    });
  }, [user, groups, userDeptId, userPosRank, isSuperAdmin]);

  /** 특정 화면(URL 또는 ScreenID)에 대한 접근 권한 판정 */
  const canAccess = useCallback(
    (urlOrId: string): boolean => {
      if (!user) return false;
      if (isSuperAdmin) return true;

      // 소속된 그룹 중 하나라도 access === true 면 허용 (OR 결합)
      const hasGroupAccess = myGroups.some((g) => {
        const perm = g.menuPermissions?.[urlOrId];
        return perm?.access === true;
      });

      if (hasGroupAccess) return true;

      // 그룹웨어 기본 URL(/gw/*)에 대해서는 로그인 사용자 기본 접근 허용 (상세 제어는 canAction으로)
      if (urlOrId.startsWith('/gw/') && user.status === '사용') {
        return true;
      }

      return false;
    },
    [user, isSuperAdmin, myGroups],
  );

  /** 특정 화면의 세부 기능(액션) 권한 판정 */
  const canAction = useCallback(
    (urlOrId: string, action: keyof ActionPermission): boolean => {
      if (!user) return false;
      if (isSuperAdmin) return true;

      // 소속된 그룹 중 하나라도 해당 액션이 true 면 허용 (OR 결합)
      const hasActionPerm = myGroups.some((g) => {
        const perm = g.menuPermissions?.[urlOrId];
        return perm?.[action] === true;
      });

      return hasActionPerm;
    },
    [user, isSuperAdmin, myGroups],
  );

  /** 특정 역할 그룹 소속 여부 확인 */
  const hasRole = useCallback(
    (groupCode: string): boolean => {
      if (isSuperAdmin) return true;
      return myGroups.some((g) => g.code === groupCode);
    },
    [isSuperAdmin, myGroups],
  );

  /** 임원 직책/직급 여부 확인 (결재/경영 문서 열람용) */
  const isExecutive = useMemo(() => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    const pos = user.position || '';
    const isExecPos = ['대표이사', '상무', '상무이사', '전무', '부사장', '사장'].includes(pos);
    return isExecPos || hasRole('EXEC');
  }, [user, isSuperAdmin, hasRole]);

  return {
    user,
    myGroups,
    isSuperAdmin,
    isExecutive,
    canAccess,
    canAction,
    hasRole,
    isLoading: isGroupsLoading || org.isLoading,
  };
}
