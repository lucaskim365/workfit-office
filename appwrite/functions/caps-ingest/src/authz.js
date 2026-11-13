/**
 * 새 권한 체계(authRoles·authAssignments)로 근태 열람 범위를 정한다 — 순수 함수, DB 조회는 main.js 가 한다.
 *
 * 웹 앱의 판정 엔진(src/domain/authz/engine.ts resolveGrants)에서 '다른 사람 근태·휴가 열람'(commute.view)
 * 한 가지만 옮겨 온 것이다. 함수가 따로 배포되어 코드를 공유하지 못하므로, 같은 결과를 내는지는
 * authz.test.mjs 가 앱 엔진과 나란히 돌려 확인한다. 엔진 규칙을 바꾸면 여기도 같이 고친다.
 *
 * - 최고 관리자 역할(kind 'super')은 모든 권한을 가진다(지정이 맞는 사람에게, 지정의 범위로 — 보통 전사).
 * - 전 직원 역할(kind 'base')은 지정 없이 모두에게, 범위는 전사.
 * - 그 밖의 역할은 지정(사람·부서·직급·부서장)이 맞을 때, 지정의 범위(전사·본인 부서·지정 조직)로.
 * - '근태 수정·연차 대장 관리'(commute.manage)는 열람을 포함한다.
 */

const VIEW = 'commute.view';
const MANAGE = 'commute.manage';

/** 부서와 그 아래 부서 전부 */
function withDescendants(depts, deptId) {
  const out = new Set([deptId]);
  let added = true;
  while (added) {
    added = false;
    for (const d of depts) {
      if (d.parentId && out.has(d.parentId) && !out.has(d.id)) {
        out.add(d.id);
        added = true;
      }
    }
  }
  return out;
}

/** 사람이 속한 부서 — 주 소속 + 겸직 + 부서장으로 있는 부서 */
function userDeptIds(user, depts) {
  const out = new Set();
  const primary = user.deptId || depts.find((d) => d.name === user.dept)?.id;
  if (primary) out.add(primary);
  for (const a of user.assignments ?? []) if (a?.deptId) out.add(a.deptId);
  for (const d of depts) if (d.headUserId && d.headUserId === user.id) out.add(d.id);
  return out;
}

function isDeptHead(user, depts) {
  return depts.some((d) => d.headUserId === user.id) || (user.assignments ?? []).some((a) => a?.role === 'HEAD');
}

function matches(a, user, org) {
  switch (a.targetType) {
    case 'USER':
      return a.targetId === user.id;
    case 'DEPT': {
      const target = a.targetSub ? withDescendants(org.depts, a.targetId) : new Set([a.targetId]);
      for (const id of userDeptIds(user, org.depts)) if (target.has(id)) return true;
      return false;
    }
    case 'POSITION': {
      const target = org.positions.find((p) => p.id === a.targetId);
      const mine = org.positions.find((p) => p.name === user.position);
      if (!target || !mine) return false;
      return a.positionMode === 'GTE' ? mine.rank <= target.rank : mine.id === target.id;
    }
    case 'DEPT_HEAD':
      return isDeptHead(user, org.depts);
    default:
      return false;
  }
}

export const givesCommuteView = (role) => role.kind === 'super' || (role.permissions ?? []).some((k) => k === VIEW || k === MANAGE);

/**
 * 근태 열람 범위.
 * @returns {null | { all: boolean, deptIds: Set<string> }} 역할이 하나도 없으면 null(옮기기 전 — 예전 판정을 쓴다).
 *   all 이면 전사, 아니면 deptIds 부서 소속만(비어 있으면 본인만).
 */
export function commuteScopeFromAuthz({ user, roles, assignments, org }) {
  if (!roles || roles.length === 0) return null;
  const out = { all: false, deptIds: new Set() };
  if (!user || user.status === '미사용') return out;
  for (const role of roles) {
    if (!role.use || !givesCommuteView(role)) continue;
    // 전 직원 역할만 지정 없이 모두에게(범위 전사). 최고 관리자 역할도 지정이 맞는 사람에게만, 지정의 범위로
    if (role.kind === 'base') {
      out.all = true;
      continue;
    }
    for (const a of assignments) {
      if (a.roleId !== role.id || !matches(a, user, org)) continue;
      if (!a.scopeType || a.scopeType === 'ALL') {
        out.all = true;
        continue;
      }
      const base = a.scopeType === 'OWN_DEPT' ? [...userDeptIds(user, org.depts)] : a.scopeDeptIds ?? [];
      for (const id of base) for (const x of a.scopeSub ? withDescendants(org.depts, id) : [id]) out.deptIds.add(x);
    }
  }
  if (out.all) out.deptIds.clear();
  return out;
}

/** Appwrite 문서 → 판정에 쓰는 모양. JSON 칸(permissions·scopeDeptIds·assignments)은 글자로 저장돼 있다 */
const json = (v, fallback) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v) {
    try {
      const x = JSON.parse(v);
      return Array.isArray(x) ? x : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
};
export const toRole = (d) => ({ id: d.id ?? d.$id, kind: d.kind, use: d.use !== false, permissions: json(d.permissions, []) });
export const toAssignment = (d) => ({
  roleId: d.roleId,
  targetType: d.targetType,
  targetId: d.targetId ?? '',
  targetSub: Boolean(d.targetSub),
  positionMode: d.positionMode ?? '',
  scopeType: d.scopeType,
  scopeDeptIds: json(d.scopeDeptIds, []),
  scopeSub: d.scopeSub !== false,
});
export const toDept = (d) => ({ id: d.id ?? d.$id, name: d.name, parentId: d.parentId ?? null, headUserId: d.headUserId ?? null });
export const toPosition = (d) => ({ id: d.id ?? d.$id, name: d.name, rank: Number(d.rank ?? 9) });
/** 계정 + 인명관리 — 웹 앱(useOrgTree)과 같이 부서·직급 이름은 인명관리를 앞세운다 */
export const toUser = (me, profile) => ({
  id: me.id,
  status: me.status,
  deptId: me.deptId || undefined,
  dept: profile?.dept || me.dept || '미지정',
  position: profile?.position || me.position || '사원',
  assignments: json(me.assignments, []),
});
