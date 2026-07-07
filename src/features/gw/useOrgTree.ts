import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { departmentRepo } from '@/data/department/department.repo';
import { userRepo } from '@/data/user/user.repo';
import { positionRepo } from '@/data/position/position.repo';
import type { Department } from '@/domain/department/schema';
import type { User } from '@/domain/user/schema';
import type { Position } from '@/domain/position/schema';

/**
 * 조직 데이터 훅 — 부서(departments) + 사용자(users) 를 조합해
 * ① 부서 트리 ② 상급자 체인(자동 상신선 원천) ③ 부서장 을 도출한다.
 *
 * **자동 도출 원칙**: 부서 노드 집합은 실제 `user.dept` 값에서 도출하므로,
 * departments 마스터가 없거나 어긋나도 사용자가 있는 부서는 항상 표시된다.
 * 마스터가 있으면 계층(parentId)·부서장(headUserId)·정렬(order)을 덧씌우고,
 * 없으면 부서장은 직급 seniority(관리자>파트장>반장>담당>사원)로, 계층은 평면으로 도출한다.
 * 상급자 체인은 user.managerId 우선, 없으면 부서장으로 폴백.
 * ([[data-layer-pattern]] 파생상태 원칙)
 */
const DEPTS_KEY = 'departments';
const USERS_KEY = 'users';
const POSITIONS_KEY = 'positions';

/** 직급 서열(작을수록 상위) — positions 마스터 미로드 시 폴백. */
const POSITION_RANK_FALLBACK: Record<string, number> = { 대표이사: 1, 상무이사: 2, 이사: 3, 소장: 3, 부장: 4, 차장: 5, 과장: 6, 대리: 7, 연구원: 8, 사원: 9 };

export interface OrgNode {
  dept: Department;
  children: OrgNode[];
  /** 이 부서에 직접 소속된 사용자(user.dept === dept.name). */
  members: User[];
}

export interface OrgTree {
  roots: OrgNode[];
  depts: Department[];
  users: User[];
  positions: Position[];
  userById: (id: string | null | undefined) => User | undefined;
  /** 직급명 → 서열(작을수록 상위). positions 마스터 우선, 폴백 상수. */
  rankOf: (position: string) => number;
  managerChain: (userId: string, depth?: number) => User[];
  deptHeadOf: (userId: string) => User | null;
}

export function useOrgTree() {
  const deptsQ = useQuery({ queryKey: [DEPTS_KEY, null], queryFn: () => departmentRepo.list() });
  const usersQ = useQuery({ queryKey: [USERS_KEY, null], queryFn: () => userRepo.list() });
  const positionsQ = useQuery({ queryKey: [POSITIONS_KEY, null], queryFn: () => positionRepo.list() });

  const data = useMemo<OrgTree>(() => {
    const masters = deptsQ.data ?? [];
    const users = usersQ.data ?? [];
    const positions = positionsQ.data ?? [];

    // 직급 서열 — 마스터 우선, 없으면 폴백 상수.
    const rankByName = new Map(positions.map((p) => [p.name, p.rank]));
    const rankOf = (position: string) => rankByName.get(position) ?? POSITION_RANK_FALLBACK[position] ?? 9;

    const usersById = new Map(users.map((u) => [u.id, u]));
    const masterByName = new Map(masters.map((d) => [d.name, d]));

    // 부서별 소속 사용자.
    const membersByDept = new Map<string, User[]>();
    for (const u of users) {
      const arr = membersByDept.get(u.dept) ?? [];
      arr.push(u);
      membersByDept.set(u.dept, arr);
    }

    /** 부서의 부서장 — 마스터 headUserId(유효 시) 우선, 없으면 소속원 중 최상위 직급. */
    const seniorHeadId = (members: User[]): string | null => {
      if (members.length === 0) return null;
      return members.slice().sort((a, b) => rankOf(a.position) - rankOf(b.position))[0].id;
    };
    const headIdOfDept = (name: string): string | null => {
      const m = masterByName.get(name);
      if (m?.headUserId && usersById.has(m.headUserId)) return m.headUserId;
      return seniorHeadId(membersByDept.get(name) ?? []);
    };

    // 부서 노드 집합 = 마스터 부서명 ∪ 실제 user.dept.
    const names = new Set<string>([...masterByName.keys(), ...membersByDept.keys()]);
    const deptOf = (name: string, idx: number): Department => {
      const m = masterByName.get(name);
      return m ?? { id: `dept:${name}`, name, parentId: null, headUserId: headIdOfDept(name), deptType: '본사', order: 1000 + idx };
    };

    const orderedNames = [...names];
    const nodeByName = new Map<string, OrgNode>(
      orderedNames.map((name, i) => [name, { dept: deptOf(name, i), children: [], members: membersByDept.get(name) ?? [] }]),
    );
    // id → 노드(계층 연결용).
    const nodeById = new Map<string, OrgNode>([...nodeByName.values()].map((n) => [n.dept.id, n]));

    const roots: OrgNode[] = [];
    for (const node of nodeByName.values()) {
      const parent = node.dept.parentId ? nodeById.get(node.dept.parentId) : null;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    // 마스터에만 존재(소속원 0)하는 상위 부서도 트리에 포함됨 — members 빈 배열.
    const byOrder = (a: OrgNode, b: OrgNode) => a.dept.order - b.dept.order || a.dept.name.localeCompare(b.dept.name);
    const sortRec = (n: OrgNode) => { n.children.sort(byOrder); n.children.forEach(sortRec); };
    roots.sort(byOrder);
    roots.forEach(sortRec);

    const userById = (id: string | null | undefined) => (id ? usersById.get(id) : undefined);

    const deptHeadOf = (userId: string): User | null => {
      const u = usersById.get(userId);
      if (!u) return null;
      const headId = headIdOfDept(u.dept);
      if (headId && headId !== userId) return usersById.get(headId) ?? null;
      // 자신이 부서장이면 상위 부서장(마스터 계층)으로.
      let m = masterByName.get(u.dept);
      while (m?.parentId) {
        const parent = masters.find((d) => d.id === m!.parentId);
        if (!parent) break;
        if (parent.headUserId && parent.headUserId !== userId) return usersById.get(parent.headUserId) ?? null;
        m = parent;
      }
      return null;
    };

    const managerChain = (userId: string, depth = 5): User[] => {
      const chain: User[] = [];
      const seen = new Set<string>([userId]);
      let cur = usersById.get(userId);
      while (cur && chain.length < depth) {
        // managerId 우선, 없으면 부서장 폴백(자동 도출).
        const mgrId = cur.managerId ?? deptHeadOf(cur.id)?.id ?? null;
        if (!mgrId || seen.has(mgrId)) break;
        const mgr = usersById.get(mgrId);
        if (!mgr) break;
        chain.push(mgr);
        seen.add(mgr.id);
        cur = mgr;
      }
      return chain;
    };

    const depts = [...nodeByName.values()].map((n) => n.dept);
    return { roots, depts, users, positions, userById, rankOf, managerChain, deptHeadOf };
  }, [deptsQ.data, usersQ.data, positionsQ.data]);

  return { ...data, isLoading: deptsQ.isLoading || usersQ.isLoading || positionsQ.isLoading };
}
