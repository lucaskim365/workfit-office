import { useMemo, useCallback } from 'react';
import { useSecurityContext } from './useSecurityContext';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useRoleGroups } from '@/features/roleGroup/useRoleGroups';
import type { ActionPermission } from '@/domain/roleGroup/schema';

/**
 * 전사 통합 권한 판정 훅 (usePermission) - v2 하위 호환 어댑터
 * 
 * - 내부적으로 v2 SSOT인 useSecurityContext()를 참조하여 단일 권한 체계를 유지합니다.
 * - 기존 수십 개 화면 컴포넌트와의 100% 무중단 하위 호환성을 완벽히 보장합니다.
 */
export function usePermission() {
  const context = useSecurityContext();
  const org = useOrgTree();
  const { isLoading: isGroupsLoading } = useRoleGroups() as { isLoading: boolean };

  const user = context.user;
  const myGroups = context.roleGroups;
  const isSuperAdmin = context.isSuperAdmin;
  const isExecutive = context.isExecutive;

  const canAccess = useCallback(
    (urlOrId: string): boolean => {
      return context.canMenuAccess(urlOrId);
    },
    [context]
  );

  const canAction = useCallback(
    (urlOrId: string, action: keyof ActionPermission): boolean => {
      return context.canMenuAction(urlOrId, action);
    },
    [context]
  );

  const hasRole = useCallback(
    (groupCode: string): boolean => {
      if (isSuperAdmin) return true;
      return myGroups.some((g) => g.code === groupCode);
    },
    [isSuperAdmin, myGroups]
  );

  const isOperator = useMemo(() => {
    if (!user) return false;
    return (
      isSuperAdmin ||
      context.roles.includes('OPERATOR') ||
      myGroups.some((g) => g.code === 'OPERATOR' || g.code === 'ROLE_OPERATOR') ||
      (user as any).role === 'operator' ||
      (user as any).role === 'admin'
    );
  }, [user, isSuperAdmin, context.roles, myGroups]);

  return {
    user,
    myGroups,
    userRoles: context.roles,
    roleNames: myGroups.map((g) => g.name || g.code),
    isSuperAdmin,
    isAdmin: isSuperAdmin,
    isOperator,
    isExecutive,
    canAccess,
    canAction,
    hasRole,
    isLoading: isGroupsLoading || org.isLoading,
  };
}

