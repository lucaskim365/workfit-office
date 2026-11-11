import { PERMISSION_BY_KEY } from './permissions';
import { resolveGrants, type AuthzOrg, type AuthzUser } from './engine';
import { scopeText, targetText } from './labels';
import { TARGET_TYPE_LABEL, type AuthAssignment, type AuthRole } from './types';

/** 변경 기록 문장 — 화면에 보이는 이름만 쓴다(ID·권한 키 없음) */

const permNames = (keys: string[]) => keys.map((k) => PERMISSION_BY_KEY.get(k)?.name ?? '없어진 권한').join(', ');

export function describeRoleChange(before: AuthRole | null, after: AuthRole | null, removedAssignments = 0): string | null {
  if (!before && after) return `역할 '${after.name}' 만듦 — 권한 ${after.permissions.length}개`;
  if (before && !after) return `역할 '${before.name}' 삭제${removedAssignments ? ` — 지정 ${removedAssignments}건 함께 삭제` : ''}`;
  if (!before || !after) return null;
  const parts: string[] = [];
  if (before.name !== after.name) parts.push(`이름: ${before.name} → ${after.name}`);
  if (before.desc !== after.desc) parts.push('설명 바꿈');
  if (before.use !== after.use) parts.push(after.use ? '사용으로' : '사용 안 함으로');
  const b = new Set(before.permissions);
  const a = new Set(after.permissions);
  const added = after.permissions.filter((k) => !b.has(k));
  const removed = before.permissions.filter((k) => !a.has(k));
  if (added.length) parts.push(`권한 추가: ${permNames(added)}`);
  if (removed.length) parts.push(`권한 제외: ${permNames(removed)}`);
  return parts.length ? `역할 '${after.name}' — ${parts.join(' / ')}` : null;
}

type Users = { id: string; name: string; dept?: string; position?: string }[];

export function describeAssignment(kind: '추가' | '삭제' | '바꿈', role: AuthRole, a: AuthAssignment, org: AuthzOrg, users: Users, scoped: boolean): string {
  const t = targetText(a, org, users);
  const who = `${TARGET_TYPE_LABEL[a.targetType]} ${t.main}${a.targetType === 'DEPT' || a.targetType === 'POSITION' ? `(${t.sub})` : ''}`;
  return `역할 '${role.name}' 지정 ${kind} — 대상: ${who}${scoped ? `, 범위: ${scopeText(a, org)}` : ''}`;
}

/** 최고 관리자 수 */
export function superAdminIds(users: AuthzUser[], roles: AuthRole[], assignments: AuthAssignment[], org: AuthzOrg): Set<string> {
  const out = new Set<string>();
  for (const u of users) if (resolveGrants(u, roles, assignments, org).isSuperAdmin) out.add(u.id);
  return out;
}

/**
 * 잠금 방지 — 바뀐 뒤 최고 관리자가 0명이면 block, 바꾸는 사람 본인이 빠지면 selfLoss.
 */
export function checkLockout(p: {
  users: AuthzUser[];
  org: AuthzOrg;
  roles: AuthRole[];
  before: AuthAssignment[];
  after: AuthAssignment[];
  meId: string | undefined;
}): { block: boolean; selfLoss: boolean } {
  const was = superAdminIds(p.users, p.roles, p.before, p.org);
  const now = superAdminIds(p.users, p.roles, p.after, p.org);
  return { block: now.size === 0, selfLoss: Boolean(p.meId && was.has(p.meId) && !now.has(p.meId)) };
}
