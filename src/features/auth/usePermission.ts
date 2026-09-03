import { useMemo, useCallback } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useRoleGroups } from '@/features/roleGroup/useRoleGroups';
import { SYSTEM_SCREENS, type RoleGroup, type ActionPermission } from '@/domain/roleGroup/schema';
import { resolveUserRoles } from '@/domain/roleGroup/roleResolver';

/**
 * 전사 통합 권한 판정 훅 (usePermission)
 * - 사용자 계정(ID, dept, position)과 활성화된 역할그룹(roleGroups)을 결합 (SSOT: roleGroups)
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

  /** 현재 사용자가 속한 모든 활성 권한 그룹 (SSOT: roleGroups) */
  const myGroups = useMemo(() => {
    return resolveUserRoles(user, groups, org);
  }, [user, groups, org]);

  /** 최고 관리자 여부 판정 */
  const isSuperAdmin = useMemo(() => {
    return myGroups.some((g) => (g.code === 'ADMIN' || g.code === 'ROLE_ADMIN') && g.use);
  }, [myGroups]);

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
    roleNames: myGroups.map((g) => g.name || g.code),
    isSuperAdmin,
    isAdmin: isSuperAdmin,
    isExecutive,
    canAccess,
    canAction,
    hasRole,
    isLoading: isGroupsLoading || org.isLoading,
  };
}
