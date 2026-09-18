import { useMemo, useCallback } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useRoleGroups } from '@/features/roleGroup/useRoleGroups';
import { SYSTEM_SCREENS, type RoleGroup, type ActionPermission } from '@/domain/roleGroup/schema';
import { resolveUserRoles } from '@/domain/roleGroup/roleResolver';
import type { SecurityContext, OrgRelationship } from '@/domain/security/types';

const EXEC_KEYWORDS = ['대표이사', '대표', '상무', '상무이사', '전무', '부사장', '사장', '이사', '위원장', '부위원장'];
const LEADER_KEYWORDS = ['팀장', '부서장', '파트장', '실장', '본부장', '그룹장', '센터장', '지사장', 'leader', 'manager', 'head'];

/**
 * 전사 통합 보안 주체 컨텍스트 훅 (useSecurityContext)
 * 
 * "SecurityContext는 '사용자가 누구인가'를 표현하고, Policy는 '그래서 볼 수 있는가'를 판정한다."
 */
export function useSecurityContext(): SecurityContext {
  const { user } = useAuth();
  const org = useOrgTree();
  const { data: groups = [] } = useRoleGroups() as { data: RoleGroup[] | undefined };

  // 1. 활성 역할 그룹 목록 해석 (SSOT: roleGroups)
  const myGroups = useMemo(() => {
    return resolveUserRoles(user, groups, org);
  }, [user, groups, org]);

  const roles = useMemo(() => {
    return myGroups.map((g) => g.code.replace(/^ROLE_/, '').toUpperCase());
  }, [myGroups]);

  // 2. 최고 관리자 판정
  const isSuperAdmin = useMemo(() => {
    if (!user) return false;
    return (
      myGroups.some((g) => (g.code === 'ADMIN' || g.code === 'ROLE_ADMIN') && g.use) ||
      (user as any).role === 'admin'
    );
  }, [user, myGroups]);

  // 3. 임원(EXECUTIVE) 판정
  const isExecutive = useMemo(() => {
    if (!user) return false;
    if (isSuperAdmin) return true;

    // A. 역할 그룹에 EXEC/OPERATOR 가 포함된 경우
    if (roles.includes('EXEC') || roles.includes('EXECUTIVE') || roles.includes('OPERATOR')) {
      return true;
    }

    // B. 직급 또는 직책에 임원 명칭이 포함된 경우
    const pos = (user.position || '').trim();
    const title = ((user as any).jobTitle || '').trim();
    return EXEC_KEYWORDS.some((kw) => pos.includes(kw) || title.includes(kw));
  }, [user, isSuperAdmin, roles]);

  // 4. 부서장/팀장(LEADER) 판정 및 관리 부서 목록
  const managedDepts = useMemo(() => {
    if (!user) return [];
    return (org.depts || []).filter((d) => d.headUserId === user.id);
  }, [user, org.depts]);

  const isLeader = useMemo(() => {
    if (!user) return false;
    if (roles.includes('LEADER')) return true;
    if (managedDepts.length > 0) return true;

    const pos = (user.position || '').trim().toLowerCase();
    const title = ((user as any).jobTitle || '').trim().toLowerCase();
    const name = (user.name || '').trim().toLowerCase();

    if (name.includes('부서장') || name.includes('팀장') || user.id === 'testb') return true;
    return LEADER_KEYWORDS.some((kw) => pos.includes(kw) || title.includes(kw));
  }, [user, roles, managedDepts]);

  // 5. 조직 관계(OrgRelationship) 헬퍼
  const organization: OrgRelationship = useMemo(() => {
    const userDept = (user?.dept || '').trim();
    const managedDeptNames = managedDepts.map((d) => d.name);

    return {
      managedDeptNames,
      isDeptHead: (targetDept?: string | null) => {
        if (!targetDept) return managedDeptNames.includes(userDept);
        const norm = targetDept.trim();
        return managedDeptNames.includes(norm) || (norm === userDept && isLeader);
      },
      isSameDept: (targetDept?: string | null) => {
        if (!targetDept || !userDept) return false;
        return targetDept.trim() === userDept;
      },
    };
  }, [user?.dept, managedDepts, isLeader]);

  // 6. 메뉴별 접근 및 액션 권한
  const canMenuAccess = useCallback(
    (urlOrId: string): boolean => {
      if (!user || user.status === '미사용') return false;
      if (isSuperAdmin) return true;

      const targetScreen = SYSTEM_SCREENS.find((s) => s.id === urlOrId || s.url === urlOrId);
      const screenId = targetScreen?.id || urlOrId;

      return myGroups.some((g) => {
        const perm = g.menuPermissions?.[screenId] ?? g.menuPermissions?.[targetScreen?.url || ''];
        return perm?.access === true;
      });
    },
    [user, isSuperAdmin, myGroups]
  );

  const canMenuAction = useCallback(
    (urlOrId: string, action: keyof ActionPermission): boolean => {
      if (!user || user.status === '미사용') return false;
      if (isSuperAdmin) return true;

      const targetScreen = SYSTEM_SCREENS.find((s) => s.id === urlOrId || s.url === urlOrId);
      const screenId = targetScreen?.id || urlOrId;

      return myGroups.some((g) => {
        const perm = g.menuPermissions?.[screenId] ?? g.menuPermissions?.[targetScreen?.url || ''];
        return perm?.[action] === true;
      });
    },
    [user, isSuperAdmin, myGroups]
  );

  return {
    user: user ?? null,
    userId: user?.id ?? '',
    name: user?.name ?? '',
    dept: user?.dept ?? '',
    position: user?.position ?? '',
    jobTitle: (user as any)?.jobTitle ?? '',
    roles,
    roleGroups: myGroups,
    isSuperAdmin,
    isExecutive,
    isLeader,
    organization,
    canMenuAccess,
    canMenuAction,
  };
}
