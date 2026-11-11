import type { RoleGroup } from '@/domain/roleGroup/schema';
import { resolveGrants, type AuthzResult, type Grant } from './engine';
import { blankAssignment, convertLegacy, RULE_PERMISSIONS } from './legacy';
import { LEGACY_SUPER_VIA, legacyGrants, type LegacyOrg, type LegacyUser } from './legacyEval';
import type { AuthAssignment, AuthRole } from './types';

/**
 * 옮기기 계획 — 옛 역할 그룹을 새 역할·지정으로 바꾸고, 사람마다 옛·새 권한을 비교한다.
 * 이름으로만 임원·부서장·운영자로 판정되던 사람은 개인 지정으로 채운다.
 */

export interface MigrationRow {
  user: LegacyUser;
  /** 옛날엔 있었는데 새 체계에서 없어지는 권한(의도하지 않은 차이) */
  missing: string[];
  /** 새 체계에서 새로 생기는 권한(의도하지 않은 차이) */
  extra: string[];
  /** 범위가 달라지는 권한 */
  scopeChanged: string[];
  /** 최고 관리자라서 열리던 업무 권한 — 새 체계에서는 따로 받아야 함(의도한 차이) */
  superOnly: string[];
}

export interface MigrationPlan {
  roles: AuthRole[];
  assignments: AuthAssignment[];
  rows: MigrationRow[];
  /** 이름으로만 판정되던 사람에게 더한 개인 지정 수 */
  filled: number;
}

const sameScope = (a: Grant, b: Grant) => a.all === b.all && (a.all || (a.deptIds.size === b.deptIds.size && [...a.deptIds].every((x) => b.deptIds.has(x))));

export function compareGrants(oldR: AuthzResult, newR: AuthzResult): Omit<MigrationRow, 'user'> {
  const missing: string[] = [];
  const extra: string[] = [];
  const scopeChanged: string[] = [];
  const superOnly: string[] = [];
  const keys = new Set([...oldR.grants.keys(), ...newR.grants.keys()]);
  for (const k of [...keys].sort()) {
    const o = oldR.grants.get(k);
    const n = newR.grants.get(k);
    if (o && !n) {
      if (o.via.every((v) => v.roleName === LEGACY_SUPER_VIA)) superOnly.push(k);
      else missing.push(k);
    } else if (!o && n) extra.push(k);
    else if (o && n && !sameScope(o, n) && !o.via.every((v) => v.roleName === LEGACY_SUPER_VIA)) scopeChanged.push(k);
  }
  return { missing, extra, scopeChanged, superOnly };
}

export function planMigration(groups: RoleGroup[], org: LegacyOrg, users: LegacyUser[]): MigrationPlan {
  const { roles, assignments } = convertLegacy(groups, org, users);
  const active = users.filter((u) => u.status !== '미사용');
  let filled = 0;

  const ensureOperatorRole = () => {
    if (!roles.some((r) => r.id === 'ROLE-OPERATOR')) {
      roles.push({ id: 'ROLE-OPERATOR', name: '운영자', desc: '후열 전달, 전사 일정·좌석 배치 관리', permissions: [...RULE_PERMISSIONS.operator], kind: 'custom', use: true, sort: 30, migratedFrom: '운영자 판정 규칙' });
    }
  };

  for (const u of active) {
    const { flags } = legacyGrants(u, groups, org);
    const has = (roleId: string) => resolveGrants(u, roles, assignments, org).roles.some((m) => m.role.id === roleId);
    if ((flags.exec || flags.execCommute) && !has('ROLE-EXEC')) {
      assignments.push(blankAssignment('ROLE-EXEC', { targetType: 'USER', targetId: u.id }));
      filled++;
    } else if (!flags.execCommute && flags.leader && !has('ROLE-HEAD')) {
      assignments.push(blankAssignment('ROLE-HEAD', { targetType: 'USER', targetId: u.id, scopeType: 'OWN_DEPT', scopeSub: false }));
      filled++;
    }
    if (flags.operatorExplicit && !has('ROLE-OPERATOR')) {
      ensureOperatorRole();
      assignments.push(blankAssignment('ROLE-OPERATOR', { targetType: 'USER', targetId: u.id }));
      filled++;
    }
  }

  const rows = active.map((u) => ({ user: u, ...compareGrants(legacyGrants(u, groups, org), resolveGrants(u, roles, assignments, org)) }));
  return { roles, assignments, rows, filled };
}
