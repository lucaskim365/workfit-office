import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/auth/AuthProvider';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { authzRepo } from '@/data/authz/authz.repo';
import { systemLogRepo } from '@/data/systemLog/systemLog.repo';
import { checkLockout, describeAssignment, describeRoleChange } from '@/domain/authz/audit';
import { PERMISSION_BY_KEY } from '@/domain/authz/permissions';
import type { AuthAssignment, AuthRole } from '@/domain/authz/types';
import type { AuthzOrg } from '@/domain/authz/engine';

/**
 * 새 권한 체계 데이터 — authRoles·authAssignments 를 읽고, 콘솔 화면의 저장·삭제를 맡는다.
 * 저장할 때마다 변경 기록(systemLogs '변경')을 남기고, 최고 관리자가 0명이 되는 변경은 막는다.
 */
export const AUTHZ_ROLES_KEY = 'authRoles';
export const AUTHZ_ASSIGNMENTS_KEY = 'authAssignments';
const SCREEN = '역할·권한 관리';

export type OrgForAuthz = ReturnType<typeof useOrgTree>;

export function toAuthzOrg(org: OrgForAuthz): AuthzOrg {
  return {
    depts: org.depts.map((d) => ({ id: d.id, name: d.name, parentId: d.parentId, headUserId: d.headUserId })),
    positions: org.positions.map((p) => ({ id: p.id, name: p.name, rank: p.rank })),
  };
}

export function useAuthRolesQuery() {
  return useQuery({ queryKey: [AUTHZ_ROLES_KEY], queryFn: () => authzRepo.listRoles(), staleTime: 60_000 });
}
export function useAuthAssignmentsQuery() {
  return useQuery({ queryKey: [AUTHZ_ASSIGNMENTS_KEY], queryFn: () => authzRepo.listAssignments(), staleTime: 60_000 });
}

/** 화면용 — 역할·지정·조직을 한 번에 */
export function useAuthzDraft() {
  const org = useOrgTree();
  const rolesQ = useAuthRolesQuery();
  const asgQ = useAuthAssignmentsQuery();
  const authzOrg = useMemo(() => toAuthzOrg(org), [org]);
  const activeUsers = useMemo(() => org.users.filter((u) => u.status !== '미사용'), [org.users]);
  return {
    ready: !org.isLoading && rolesQ.isSuccess && asgQ.isSuccess,
    error: rolesQ.error ?? asgQ.error,
    roles: rolesQ.data ?? [],
    assignments: asgQ.data ?? [],
    org,
    authzOrg,
    activeUsers,
  };
}

/** 저장 중 막힌 이유 — 화면이 알림 창으로 보여준다 */
export class AuthzBlockedError extends Error {
  constructor(
    public readonly kind: 'lockout' | 'selfLoss' | 'duplicate' | 'fixed',
    message: string,
  ) {
    super(message);
    this.name = 'AuthzBlockedError';
  }
}

const LOCKOUT_MSG = '최고 관리자가 한 명도 남지 않아 저장할 수 없습니다. 다른 사람을 먼저 최고 관리자로 지정하세요.';
const SELF_MSG = '저장하면 본인의 최고 관리자 권한이 없어져 관리자 콘솔을 쓸 수 없게 됩니다. 계속할까요?';

export function useAuthzActions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { roles, assignments, org, authzOrg, activeUsers } = useAuthzDraft();

  const me = user ? { id: user.id, empNo: user.empNo, name: user.name } : null;
  const log = useCallback((detail: string | null) => (detail && me ? systemLogRepo.recordChange({ user: me, screen: SCREEN, detail }) : Promise.resolve()), [me]);
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: [AUTHZ_ROLES_KEY] }), qc.invalidateQueries({ queryKey: [AUTHZ_ASSIGNMENTS_KEY] })]);
  const stamp = () => ({ updatedAt: new Date().toISOString(), updatedBy: user?.id ?? '' });
  const scopedRole = (r: AuthRole) => r.kind !== 'super' && r.permissions.some((k) => PERMISSION_BY_KEY.get(k)?.scoped);
  const roleOf = (id: string) => roles.find((r) => r.id === id);

  /** 최고 관리자 지정이 바뀌는 경우의 잠금 검사 */
  const guard = (after: AuthAssignment[], confirmSelf: boolean) => {
    const res = checkLockout({ users: activeUsers, org: authzOrg, roles, before: assignments, after, meId: user?.id });
    if (res.block) throw new AuthzBlockedError('lockout', LOCKOUT_MSG);
    if (res.selfLoss && !confirmSelf) throw new AuthzBlockedError('selfLoss', SELF_MSG);
  };

  const mutation = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
    onSettled: () => refresh(),
  });
  const run = (fn: () => Promise<void>) => mutation.mutateAsync(fn);

  return {
    pending: mutation.isPending,

    saveRole: (next: AuthRole) =>
      run(async () => {
        const before = roleOf(next.id) ?? null;
        const name = next.name.trim();
        if (roles.some((r) => r.id !== next.id && r.name === name)) throw new AuthzBlockedError('duplicate', '같은 이름의 역할이 이미 있습니다.');
        if (before && before.kind !== 'custom' && (before.name !== name || before.use !== next.use)) throw new AuthzBlockedError('fixed', '기본 역할의 이름과 사용 여부는 바꿀 수 없습니다.');
        // 전 직원 역할에 콘솔 권한, 일반 역할에 최고 관리자 전용 권한은 넣지 않는다
        const permissions = next.kind === 'super' ? [] : next.permissions.filter((k) => {
          const d = PERMISSION_BY_KEY.get(k);
          return d && d.grantable !== false && !(next.kind === 'base' && d.adminConsole);
        });
        const row: AuthRole = { ...next, name, permissions: [...new Set(permissions)].sort(), ...stamp() };
        await authzRepo.saveRole(row);
        await log(describeRoleChange(before, row));
      }),

    createRole: async (p: Pick<AuthRole, 'name' | 'desc' | 'permissions'>): Promise<AuthRole> => {
      const name = p.name.trim();
      if (roles.some((r) => r.name === name)) throw new AuthzBlockedError('duplicate', '같은 이름의 역할이 이미 있습니다.');
      const role: AuthRole = {
        id: authzRepo.newRoleId(),
        name,
        desc: p.desc.trim(),
        permissions: p.permissions.filter((k) => PERMISSION_BY_KEY.get(k)?.grantable !== false),
        kind: 'custom',
        use: true,
        sort: Math.max(0, ...roles.map((r) => r.sort)) + 1,
        migratedFrom: '',
        ...stamp(),
      };
      await run(async () => {
        await authzRepo.insertRole(role);
        await log(describeRoleChange(null, role));
      });
      return role;
    },

    removeRole: (id: string) =>
      run(async () => {
        const role = roleOf(id);
        if (!role || role.kind !== 'custom') throw new AuthzBlockedError('fixed', '기본 역할은 삭제할 수 없습니다.');
        const mine = assignments.filter((a) => a.roleId === id);
        for (const a of mine) await authzRepo.removeAssignment(a.id);
        await authzRepo.removeRole(id);
        await log(describeRoleChange(role, null, mine.length));
      }),

    addAssignments: (list: Omit<AuthAssignment, 'id'>[]) =>
      run(async () => {
        for (const x of list) {
          const role = roleOf(x.roleId);
          if (!role || role.kind === 'base') continue;
          const a: AuthAssignment = { ...x, id: authzRepo.newAssignmentId(), regBy: user?.id ?? '', regAt: new Date().toISOString() };
          await authzRepo.insertAssignment(a);
          await log(describeAssignment('추가', role, a, authzOrg, org.users, scopedRole(role)));
        }
      }),

    updateAssignment: (a: AuthAssignment, opts: { confirmSelf?: boolean } = {}) =>
      run(async () => {
        const role = roleOf(a.roleId);
        if (!role) return;
        if (role.kind === 'super') guard(assignments.map((x) => (x.id === a.id ? a : x)), Boolean(opts.confirmSelf));
        await authzRepo.saveAssignment(a);
        await log(describeAssignment('바꿈', role, a, authzOrg, org.users, scopedRole(role)));
      }),

    removeAssignment: (id: string, opts: { confirmSelf?: boolean } = {}) =>
      run(async () => {
        const a = assignments.find((x) => x.id === id);
        const role = a && roleOf(a.roleId);
        if (!a || !role) return;
        if (role.kind === 'super') guard(assignments.filter((x) => x.id !== id), Boolean(opts.confirmSelf));
        await authzRepo.removeAssignment(id);
        await log(describeAssignment('삭제', role, a, authzOrg, org.users, scopedRole(role)));
      }),
  };
}
