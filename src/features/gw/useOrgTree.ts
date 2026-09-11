import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { departmentRepo } from '@/data/department/department.repo';
import { userRepo } from '@/data/user/user.repo';
import { employeeProfileRepo } from '@/data/employeeProfile/employeeProfile.repo';
import { positionRepo } from '@/data/position/position.repo';
import { departmentMemberRepo } from '@/data/departmentMember/departmentMember.repo';
import type { Department } from '@/domain/department/schema';
import type { User } from '@/domain/user/schema';
import type { Position } from '@/domain/position/schema';

/**
 * 조직 데이터 훅 — 부서(departments) + 사용자(users) + 인사마스터(employeeProfiles) + 소속/겸직(departmentMembers)를 조합해
 * ① 부서 트리(겸직 포함) ② 상급자 체인 ③ 부서장을 도출한다.
 */
const DEPTS_KEY = 'departments';
const USERS_KEY = 'users';
const PROFILES_KEY = 'employeeProfiles';
const POSITIONS_KEY = 'positions';
const DEPT_MEMBERS_KEY = 'departmentMembers';

/** 직급 서열(작을수록 상위) — positions 마스터 미로드 시 폴백. */
const POSITION_RANK_FALLBACK: Record<string, number> = { 대표이사: 1, 상무이사: 2, 이사: 3, 소장: 3, 부장: 4, 차장: 5, 과장: 6, 대리: 7, 연구원: 8, 사원: 9 };

export interface OrgMemberUser extends User {
  /** 겸직 여부 (본직이 아닌 추가 소속인 경우 true) */
  isConcurrent?: boolean;
}

export interface OrgNode {
  dept: Department;
  children: OrgNode[];
  /** 이 부서에 소속된 사용자 (본직 + 겸직자 포함) */
  members: OrgMemberUser[];
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
  directManagerOf: (userId: string) => User | null;
}

export function useOrgTree() {
  const deptsQ = useQuery({ queryKey: [DEPTS_KEY, null], queryFn: () => departmentRepo.list() });
  const usersQ = useQuery({ queryKey: [USERS_KEY, null], queryFn: () => userRepo.list() });
  const profilesQ = useQuery({ queryKey: [PROFILES_KEY], queryFn: () => employeeProfileRepo.list() });
  const positionsQ = useQuery({ queryKey: [POSITIONS_KEY, null], queryFn: () => positionRepo.list() });
  const deptMembersQ = useQuery({ queryKey: [DEPT_MEMBERS_KEY], queryFn: () => departmentMemberRepo.list() });

  const data = useMemo<OrgTree>(() => {
    const masters = deptsQ.data ?? [];
    const rawUsers = usersQ.data ?? [];
    const profiles = profilesQ.data ?? [];
    const profileMap = new Map(profiles.map((p) => [p.userId || p.id, p]));

    // 인사 마스터(employeeProfiles)를 기준으로 사용자 부서/직급/직책 실시간 조인
    const users: User[] = rawUsers
      .filter((u) => u.status !== '미사용')
      .map((u) => {
        const p = profileMap.get(u.id);
        return {
          ...u,
          dept: p?.dept || u.dept || '미지정',
          position: p?.position || u.position || '사원',
          jobTitle: p?.jobTitle || u.jobTitle || '',
          phone: p?.phone || (u as any).phone || '',
        };
      });
    const positions = positionsQ.data ?? [];

    // 직급 서열 — 마스터 우선, 없으면 폴백 상수.
    const rankByName = new Map(positions.map((p) => [p.name, p.rank]));
    const rankOf = (position: string) => rankByName.get(position) ?? POSITION_RANK_FALLBACK[position] ?? 9;

    const usersById = new Map(users.map((u) => [u.id, u]));
    const masterByName = new Map(masters.map((d) => [d.name, d]));

    const deptMembers = deptMembersQ.data ?? [];

    // 부서별 소속 사용자 (본직).
    const membersByDept = new Map<string, OrgMemberUser[]>();
    for (const u of users) {
      const arr = membersByDept.get(u.dept) ?? [];
      arr.push({ ...u, isConcurrent: false });
      membersByDept.set(u.dept, arr);
    }

    // 겸직(isPrimary === false) 소속자도 해당 부서 목록에 추가
    for (const dm of deptMembers) {
      if (dm.isPrimary) continue; // 본직은 이미 위에서 추가됨
      const baseUser = usersById.get(dm.userId);
      if (!baseUser) continue;

      // 마스터 부서 매칭 (deptId 또는 deptName 기반으로 정확한 마스터 부서명 획득)
      const targetDept = masters.find((d) => d.id === dm.deptId) || masters.find((d) => d.name === dm.deptName);
      const deptName = targetDept?.name || dm.deptName;

      const arr = membersByDept.get(deptName) ?? [];
      if (!arr.some((m) => m.id === baseUser.id)) {
        arr.push({
          ...baseUser,
          dept: deptName,
          jobTitle: dm.jobTitle, // 겸직 부서에서의 직책
          isConcurrent: true,
        });
        membersByDept.set(deptName, arr);
      }
    }

    /** 부서의 부서장 — 1) 직책(팀장/본부장/소장) 2) 마스터 headUserId 3) 소속원 중 최상위 직급 */
    const seniorHeadId = (members: User[]): string | null => {
      if (members.length === 0) return null;
      const leader = members.find(
        (m) =>
          m.jobTitle?.includes('팀장') ||
          m.jobTitle?.includes('본부장') ||
          m.jobTitle?.includes('소장') ||
          m.jobTitle?.includes('대표'),
      );
      if (leader) return leader.id;
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

    /**
     * 직속 상급자 도출:
     * - 일반 팀원: 소속 부서의 부서장(팀장)
     * - 부서장/팀장: 상위 부서(parentId)의 부서장(본부장/대표이사)
     */
    const directManagerOf = (userId: string): User | null => {
      const u = usersById.get(userId);
      if (!u) return null;

      // 대표이사는 상급자 없음
      if (u.position.includes('대표') || u.dept === '대표이사') return null;

      const deptHeadId = headIdOfDept(u.dept);

      // 1. 본인이 부서장이 아닌 경우 ➔ 해당 부서의 부서장
      if (deptHeadId && deptHeadId !== userId) {
        return usersById.get(deptHeadId) ?? null;
      }

      // 2. 본인이 부서장(팀장)인 경우 ➔ 상위 부서(parentId)의 부서장
      let curDept = masterByName.get(u.dept) ?? [...nodeByName.values()].find((n) => n.dept.name === u.dept)?.dept;
      while (curDept?.parentId) {
        const parent =
          masters.find((d) => d.id === curDept!.parentId) ??
          [...nodeByName.values()].find((n) => n.dept.id === curDept!.parentId)?.dept;
        if (!parent) break;
        const parentHeadId = headIdOfDept(parent.name);
        if (parentHeadId && parentHeadId !== userId) {
          return usersById.get(parentHeadId) ?? null;
        }
        curDept = parent;
      }

      // 3. 최상위 대표이사로 폴백
      const ceo = users.find((user) => user.position.includes('대표') || user.dept === '대표이사');
      if (ceo && ceo.id !== userId) return ceo;

      return null;
    };

    const deptHeadOf = (userId: string): User | null => directManagerOf(userId);

    const managerChain = (userId: string, depth = 5): User[] => {
      const chain: User[] = [];
      const seen = new Set<string>([userId]);
      let cur = usersById.get(userId);
      while (cur && chain.length < depth) {
        const mgr = directManagerOf(cur.id);
        if (!mgr || seen.has(mgr.id)) break;
        chain.push(mgr);
        seen.add(mgr.id);
        cur = mgr;
      }
      return chain;
    };

    const depts = [...nodeByName.values()].map((n) => n.dept);
    return { roots, depts, users, positions, userById, rankOf, managerChain, deptHeadOf, directManagerOf };
  }, [deptsQ.data, usersQ.data, profilesQ.data, positionsQ.data, deptMembersQ.data]);

  return { ...data, isLoading: deptsQ.isLoading || usersQ.isLoading || profilesQ.isLoading || positionsQ.isLoading || deptMembersQ.isLoading };
}
