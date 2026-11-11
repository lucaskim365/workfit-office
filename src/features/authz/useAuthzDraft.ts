import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useRoleGroups } from '@/features/roleGroup/useRoleGroups';
import type { RoleGroup } from '@/domain/roleGroup/schema';
import { convertLegacy } from '@/domain/authz/legacy';
import type { AuthAssignment, AuthRole } from '@/domain/authz/types';
import type { AuthzOrg } from '@/domain/authz/engine';

/**
 * 역할·지정 작업본 — 화면 개편 1차(UI 먼저)용. 지금 역할 그룹을 새 체계로 옮긴 결과로 시작해
 * 이 창 안에서만 바뀐다(저장소 연결은 다음 단계).
 */
interface State {
  ready: boolean;
  roles: AuthRole[];
  assignments: AuthAssignment[];
}

let state: State = { ready: false, roles: [], assignments: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  emit();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let nextId = 1;
const newId = (p: string) => `${p}-N${(nextId++).toString(36)}`;

export const authzDraft = {
  saveRole(role: AuthRole) {
    const exists = state.roles.some((r) => r.id === role.id);
    set({ roles: exists ? state.roles.map((r) => (r.id === role.id ? role : r)) : [...state.roles, role] });
  },
  createRole(p: Pick<AuthRole, 'name' | 'desc' | 'permissions'>): AuthRole {
    const role: AuthRole = { ...p, id: newId('ROLE'), kind: 'custom', use: true, sort: Math.max(0, ...state.roles.map((r) => r.sort)) + 1 };
    set({ roles: [...state.roles, role] });
    return role;
  },
  removeRole(id: string) {
    set({ roles: state.roles.filter((r) => r.id !== id), assignments: state.assignments.filter((a) => a.roleId !== id) });
  },
  addAssignments(list: Omit<AuthAssignment, 'id'>[]) {
    set({ assignments: [...state.assignments, ...list.map((a) => ({ ...a, id: newId('ASG') }))] });
  },
  updateAssignment(a: AuthAssignment) {
    set({ assignments: state.assignments.map((x) => (x.id === a.id ? a : x)) });
  },
  removeAssignment(id: string) {
    set({ assignments: state.assignments.filter((a) => a.id !== id) });
  },
};

export type OrgForAuthz = ReturnType<typeof useOrgTree>;

/** 엔진에 넘길 조직 정보 */
export function toAuthzOrg(org: OrgForAuthz): AuthzOrg {
  return {
    depts: org.depts.map((d) => ({ id: d.id, name: d.name, parentId: d.parentId, headUserId: d.headUserId })),
    positions: org.positions.map((p) => ({ id: p.id, name: p.name, rank: p.rank })),
  };
}

export function useAuthzDraft() {
  const org = useOrgTree();
  const groupsQ = useRoleGroups() as { data?: RoleGroup[]; isLoading: boolean };
  const snap = useSyncExternalStore(subscribe, () => state);

  useEffect(() => {
    if (state.ready || org.isLoading || groupsQ.isLoading || !groupsQ.data) return;
    const { roles, assignments } = convertLegacy(
      groupsQ.data,
      { ...toAuthzOrg(org), positions: org.positions.map((p) => ({ id: p.id, name: p.name, rank: p.rank, isExecutiveRole: p.isExecutiveRole, isLeaderRole: p.isLeaderRole })) },
      org.users.map((u) => ({ id: u.id, empNo: u.empNo, name: u.name, role: (u as { role?: string }).role })),
    );
    set({ ready: true, roles, assignments });
  }, [org, groupsQ.isLoading, groupsQ.data]);

  const authzOrg = useMemo(() => toAuthzOrg(org), [org]);
  const activeUsers = useMemo(() => org.users.filter((u) => u.status !== '미사용'), [org.users]);
  return { ...snap, org, authzOrg, activeUsers };
}
