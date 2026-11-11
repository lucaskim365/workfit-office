import { useCallback, useMemo } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useRoleGroups } from '@/features/roleGroup/useRoleGroups';
import type { RoleGroup } from '@/domain/roleGroup/schema';
import { can as canKey, canOnDept as canOnDeptKey, canOnUser as canOnUserKey, canUseAdminConsole, resolveGrants, type AuthzUser } from '@/domain/authz/engine';
import { legacyGrants, type LegacyOrg, type LegacyUser } from '@/domain/authz/legacyEval';
import { screenActionPerms } from '@/domain/authz/screenPerms';
import { useAuthAssignmentsQuery, useAuthRolesQuery } from './useAuthzDraft';

export type DataScope = 'MY_ONLY' | 'TEAM' | 'TEAM_AND_LEADERS' | 'ALL';

/**
 * 권한 판정 — 화면·버튼은 can('권한 키') 로 묻는다.
 * 새 권한 체계로 옮긴 뒤(authRoles 에 역할이 있음)에는 역할·지정으로, 옮기기 전에는 예전 판정을 새 키로 바꿔 답한다.
 */
export function useAuthz() {
  const { user } = useAuth();
  const org = useOrgTree();
  const rolesQ = useAuthRolesQuery();
  const asgQ = useAuthAssignmentsQuery();
  const groupsQ = useRoleGroups() as { data?: RoleGroup[]; isLoading: boolean };
  const active = (rolesQ.data?.length ?? 0) > 0;
  const isLoading = !user ? false : org.isLoading || rolesQ.isLoading || asgQ.isLoading || (!active && groupsQ.isLoading);

  const legacyOrg = useMemo<LegacyOrg>(
    () => ({
      depts: org.depts.map((d) => ({ id: d.id, name: d.name, parentId: d.parentId, headUserId: d.headUserId })),
      positions: org.positions.map((p) => ({ id: p.id, name: p.name, rank: p.rank, isExecutiveRole: p.isExecutiveRole, isLeaderRole: p.isLeaderRole, isDeptHead: p.isDeptHead })),
    }),
    [org.depts, org.positions],
  );
  // 조직 정보(겸직·부서 ID)가 붙은 본인
  const me = useMemo(() => (user ? ({ ...user, ...(org.users.find((u) => u.id === user.id) ?? {}) } as LegacyUser & AuthzUser) : null), [user, org.users]);

  const result = useMemo(
    () => (active ? resolveGrants(me, rolesQ.data ?? [], asgQ.data ?? [], legacyOrg) : legacyGrants(me, groupsQ.data ?? [], legacyOrg)),
    [active, me, rolesQ.data, asgQ.data, groupsQ.data, legacyOrg],
  );

  const can = useCallback((key: string) => canKey(result, key), [result]);
  const canOnUser = useCallback((key: string, target: AuthzUser) => canOnUserKey(result, key, target, legacyOrg), [result, legacyOrg]);
  const canOnDept = useCallback((key: string, deptId: string) => canOnDeptKey(result, key, deptId), [result]);
  /** 옛 화면 단위 판정(canAccess·canAction)을 새 권한으로 */
  const canScreen = useCallback(
    (urlOrId: string, action: 'access' | 'create' | 'update' | 'delete' = 'access') => {
      if (!me || me.status === '미사용') return false;
      const perms = screenActionPerms(urlOrId, action);
      if (perms === null) return result.isSuperAdmin;
      return perms.some((k) => result.grants.has(k));
    },
    [me, result],
  );
  /** 근태 조회 범위 — 전사 / 본인 부서 / 본인만 */
  const commuteScope = useCallback((): DataScope => {
    const g = result.grants.get('commute.view');
    if (!g) return 'MY_ONLY';
    return g.all ? 'ALL' : 'TEAM';
  }, [result]);

  return {
    active,
    isLoading,
    result,
    isSuperAdmin: result.isSuperAdmin,
    canUseConsole: Boolean(me) && (active ? canUseAdminConsole(result) : result.isSuperAdmin),
    can,
    canOnUser,
    canOnDept,
    canScreen,
    commuteScope,
  };
}
