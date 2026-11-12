import { useCallback, useMemo } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useRoleGroups } from '@/features/roleGroup/useRoleGroups';
import type { RoleGroup } from '@/domain/roleGroup/schema';
import { can as canKey, canOnDept as canOnDeptKey, canOnUser as canOnUserKey, canUseAdminConsole, resolveGrants, type AuthzUser } from '@/domain/authz/engine';
import { legacyGrants, type LegacyOrg, type LegacyUser } from '@/domain/authz/legacyEval';
import { screenActionPerms } from '@/domain/authz/screenPerms';
import { useAuthAssignmentsQuery, useAuthRolesQuery } from './useAuthzDraft';

const grantsHas = (r: { grants: Map<string, unknown> }, key: string) => r.grants.has(key);

/** 새 체계로 옮긴 뒤 닫는 옛 그룹 권한 관리 화면 */
export const LEGACY_AUTH_SCREENS = new Set(['/base/auth', 'S_SYS_AUTH', 'S_BASE_AUTH']);

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
  /**
   * 관리 권한 — 남의 데이터를 고치는 업무 기능. 새 체계에서는 그 권한을 받은 사람만(최고 관리자는 모든 권한을 가짐),
   * 옮기기 전에는 예전처럼 최고 관리자도 통과.
   */
  const canManage = useCallback((key: string) => grantsHas(result, key) || (!active && result.isSuperAdmin), [result, active]);
  /** 옛 화면 단위 판정(canAccess·canAction)을 새 권한으로 */
  const canScreen = useCallback(
    (urlOrId: string, action: 'access' | 'create' | 'update' | 'delete' = 'access') => {
      if (!me || me.status === '미사용') return false;
      // 옛 그룹 권한 관리 화면은 새 체계로 옮긴 뒤에는 쓰지 않는다(역할 관리가 대신함)
      if (active && LEGACY_AUTH_SCREENS.has(urlOrId)) return false;
      const perms = screenActionPerms(urlOrId, action);
      if (perms === null) return result.isSuperAdmin;
      if (perms.length === 0) return true;
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

  /** 근태를 볼 수 있는 부서 이름 — 전사이거나 옮기기 전(예전처럼 본인 부서 이름으로 비교)이면 null */
  const commuteDeptNames = useMemo(() => {
    const g = result.grants.get('commute.view');
    if (!active || !g || g.all) return null;
    return new Set(org.depts.filter((d) => g.deptIds.has(d.id)).map((d) => d.name.trim()));
  }, [active, result, org.depts]);

  return {
    active,
    commuteDeptNames,
    isLoading,
    result,
    isSuperAdmin: result.isSuperAdmin,
    // 관리자 콘솔 접속 권한이 있으면(옮기기 전에는 예전 그룹 권한의 기준정보·시스템 화면 권한이 이것을 준다)
    canUseConsole: Boolean(me) && me!.status !== '미사용' && canUseAdminConsole(result),
    can,
    canManage,
    canOnUser,
    canOnDept,
    canScreen,
    commuteScope,
  };
}
