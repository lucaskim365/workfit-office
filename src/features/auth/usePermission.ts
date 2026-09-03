import { useMemo, useCallback } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useRoleGroups } from '@/features/roleGroup/useRoleGroups';
import { SYSTEM_SCREENS, type RoleGroup, type ActionPermission } from '@/domain/roleGroup/schema';

/**
 * 전사 통합 권한 판정 훅 (usePermission)
 * - 사용자 계정(ID, dept, position)과 활성화된 역할그룹(roleGroups / roleMappings)을 결합
 * - 1인 다중 권한 그룹 소속 지원 & 포용적 합집합(OR Rule)으로 최종 권한을 실시간 계산
 * - 최고 관리자(ADMIN 그룹 바인딩) 바이패스 및 35개 시스템 메뉴 권한 매트릭스 100% 엄격 판정
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

  /** 최고 관리자 여부 판정 (오직 DB roleGroups 및 roleMappings 대상자 바인딩 기반) */
  const isSuperAdmin = useMemo(() => {
    if (!user || user.status === '미사용') return false;
    // 1) roleGroups 컬렉션에서 ADMIN 그룹 조회
    const adminGroup = groups.find((g) => (g.code === 'ADMIN' || g.code === 'ROLE_ADMIN') && g.use);
    if (adminGroup) {
      if (adminGroup.userIds?.includes(user.id) || (user.empNo && adminGroup.userIds?.includes(user.empNo))) return true;
      if (userDeptId && adminGroup.deptIds?.includes(userDeptId)) return true;
      if (userPosRank != null && adminGroup.positionRanks?.includes(userPosRank)) return true;
      if (adminGroup.members?.some((m) => m.code === user.id || (user.empNo && m.code === user.empNo) || m.name === user.name)) return true;
    }
    // 2) 사용자 문서의 roleGroup 이 ADMIN 인 경우도 호환 지원
    if (user.roleGroup === 'ADMIN') return true;
    return false;
  }, [user, groups, userDeptId, userPosRank]);

  /** 현재 사용자가 속한 모든 활성 권한 그룹 (다중 소속 합산 - SSOT: roleGroups) */
  const myGroups = useMemo(() => {
    if (!user || user.status === '미사용') return [];
    return groups.filter((g) => {
      if (!g.use) return false;
      const normCode = g.code.replace(/^ROLE_/, '').toUpperCase();
      // 0) 일반사원(USER) 그룹은 활성화된 모든 로그인 임직원에게 기본 상시 부여 (전사 기본 권한 베이스라인)
      if (normCode === 'USER') return true;
      // 1) 최고 관리자일 경우
      if (normCode === 'ADMIN' && isSuperAdmin) return true;
      // 2) 개별 사원 ID / 사번 바인딩
      if (g.userIds && (g.userIds.includes(user.id) || (user.empNo && g.userIds.includes(user.empNo)))) return true;
      // 3) 부서 단위 바인딩
      if (userDeptId && g.deptIds && g.deptIds.includes(userDeptId)) return true;
      // 4) 직급 단위 바인딩
      if (userPosRank != null && g.positionRanks && g.positionRanks.includes(userPosRank)) return true;
      // 5) 레거시 members 배열 지원
      if (g.members && g.members.some((m) => m.code === user.id || (user.empNo && m.code === user.empNo) || m.name === user.name)) return true;
      return false;
    });
  }, [user, groups, userDeptId, userPosRank, isSuperAdmin]);

  /** 특정 화면(URL 또는 ScreenID)에 대한 접근 권한 판정 (35개 메뉴 매트릭스 엄격 판정) */
  const canAccess = useCallback(
    (urlOrId: string): boolean => {
      if (!user || user.status === '미사용') return false;
      if (isSuperAdmin) return true;

      // URL 또는 ID를 단일 표준 Screen ID로 정규화
      const targetScreen = SYSTEM_SCREENS.find((s) => s.id === urlOrId || s.url === urlOrId);
      const screenId = targetScreen?.id || urlOrId;

      // 소속된 그룹 중 하나라도 access === true 면 허용 (OR 결합)
      return myGroups.some((g) => {
        const perm = g.menuPermissions?.[screenId] ?? g.menuPermissions?.[targetScreen?.url || ''];
        return perm?.access === true;
      });
    },
    [user, isSuperAdmin, myGroups],
  );

  /** 특정 화면의 세부 기능(액션) 권한 판정 */
  const canAction = useCallback(
    (urlOrId: string, action: keyof ActionPermission): boolean => {
      if (!user || user.status === '미사용') return false;
      if (isSuperAdmin) return true;

      const targetScreen = SYSTEM_SCREENS.find((s) => s.id === urlOrId || s.url === urlOrId);
      const screenId = targetScreen?.id || urlOrId;

      // 소속된 그룹 중 하나라도 해당 액션이 true 면 허용 (OR 결합)
      return myGroups.some((g) => {
        const perm = g.menuPermissions?.[screenId] ?? g.menuPermissions?.[targetScreen?.url || ''];
        return perm?.[action] === true;
      });
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
    userRoles: myGroups.map((g) => g.code.replace(/^ROLE_/, '').toUpperCase()),
    isSuperAdmin,
    isAdmin: isSuperAdmin,
    isExecutive,
    canAccess,
    canAction,
    hasRole,
    isLoading: isGroupsLoading || org.isLoading,
  };
}
