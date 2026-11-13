import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planMigration } from './migrate';
import { legacyGrants, type LegacyOrg } from './legacyEval';

const org: LegacyOrg = {
  depts: [
    { id: 'D1', name: '본부', parentId: null, headUserId: 'boss' },
    { id: 'D2', name: '1팀', parentId: 'D1', headUserId: 'lead' },
    { id: 'D3', name: '2팀', parentId: 'D1' },
  ],
  positions: [
    { id: 'P1', name: '이사', rank: 3, isExecutiveRole: true },
    { id: 'P2', name: '부장', rank: 4 },
    { id: 'P3', name: '사원', rank: 9 },
    { id: 'P4', name: '연구원', rank: 9 },
  ],
};
const u = (id: string, dept: string, position: string, extra: Record<string, unknown> = {}) => ({ id, name: id, dept, position, status: '사용', ...extra });
const users = [
  u('boss', '본부', '이사'),
  u('lead', '1팀', '부장'),
  u('s1', '1팀', '사원'),
  u('s2', '2팀', '사원', { jobTitle: '팀장' }), // 직책 이름으로만 부서장
  u('adm', '2팀', '연구원'),
  u('gone', '2팀', '사원', { status: '미사용' }),
];
const groups = [
  { code: 'ADMIN', name: '관리자', desc: '', use: true, isSystem: true, userIds: ['adm'], deptIds: [], positionRanks: [], menuPermissions: { S_GW_BOARD: { access: true, create: true, update: true, delete: true } }, members: [] },
  { code: 'USER', name: '일반사원', desc: '', use: true, isSystem: true, userIds: [], deptIds: [], positionRanks: [], menuPermissions: { S_GW_BOARD: { access: true, create: true, update: false, delete: false } }, members: [] },
];

test('옮기기 — 이름으로만 판정되던 부서장은 개인 지정으로 채워 차이 없음', () => {
  const plan = planMigration(groups as never, org, users);
  const s2 = plan.rows.find((r) => r.user.id === 's2')!;
  assert.deepEqual([s2.missing, s2.extra, s2.scopeChanged], [[], [], []]);
  assert.ok(plan.assignments.some((a) => a.roleId === 'ROLE-HEAD' && a.targetType === 'USER' && a.targetId === 's2'));
  assert.ok(plan.filled >= 1);
});

test('옮기기 — 임원·부서장·일반 직원은 권한이 같고, 미사용 직원은 표에 없다', () => {
  const plan = planMigration(groups as never, org, users);
  for (const id of ['boss', 'lead', 's1']) {
    const r = plan.rows.find((x) => x.user.id === id)!;
    assert.deepEqual([r.missing, r.extra, r.scopeChanged], [[], [], []], id);
  }
  assert.ok(!plan.rows.some((r) => r.user.id === 'gone'));
});

test('옮기기 — 최고 관리자는 예전·새 체계 모두 모든 권한이라 차이가 없다', () => {
  const plan = planMigration(groups as never, org, users);
  const adm = plan.rows.find((r) => r.user.id === 'adm')!;
  assert.deepEqual([adm.missing, adm.extra, adm.scopeChanged], [[], [], []]);
  assert.deepEqual(adm.superOnly, []);
});

test('옛 판정 — 부서장은 본인 부서 근태만, 임원은 전사', () => {
  const lead = legacyGrants(users[1], groups as never, org).grants.get('commute.view')!;
  assert.equal(lead.all, false);
  assert.ok(lead.deptIds.has('D2'));
  assert.equal(legacyGrants(users[0], groups as never, org).grants.get('commute.view')?.all, true);
  assert.equal(legacyGrants(users[2], groups as never, org).grants.has('commute.view'), false);
});

import { checkUserChangeLockout } from './audit';
import type { AuthAssignment, AuthRole } from './types';

test('사용자 변경 잠금 방지 — 마지막 최고 관리자를 미사용·삭제하면 막고, 다른 관리자가 있으면 통과', () => {
  const roles: AuthRole[] = [{ id: 'S', name: '최고 관리자', desc: '', permissions: [], kind: 'super', use: true, sort: 0 }];
  const asg = (targetType: AuthAssignment['targetType'], targetId: string): AuthAssignment => ({ id: targetId, roleId: 'S', targetType, targetId, targetSub: false, positionMode: 'EQ', scopeType: 'ALL', scopeDeptIds: [], scopeSub: false });
  const one = [asg('USER', 'adm')];
  const base = { users, org, roles, meId: 'boss' };
  assert.equal(checkUserChangeLockout({ ...base, assignments: one, changed: [{ ...users[4], status: '미사용' }] }).block, true);
  assert.equal(checkUserChangeLockout({ ...base, assignments: one, removedIds: ['adm'] }).block, true);
  assert.equal(checkUserChangeLockout({ ...base, assignments: one, changed: [{ ...users[2], status: '미사용' }] }).block, false);
  // 부서로 받은 최고 관리자 — 부서를 옮기면 빠진다
  const byDept = [asg('DEPT', 'D3')];
  assert.equal(checkUserChangeLockout({ ...base, assignments: byDept, changed: [{ ...users[4], dept: '1팀' }] }).block, false, '2팀에 다른 최고 관리자(s2)가 남음');
  assert.equal(checkUserChangeLockout({ ...base, assignments: byDept, changed: [{ ...users[4], dept: '1팀' }, { ...users[3], dept: '1팀' }] }).block, true);
  assert.equal(checkUserChangeLockout({ ...base, assignments: [...one, asg('USER', 'boss')], changed: [{ ...users[0], status: '잠금' }] }).selfLoss, true);
});

test('옮기기 전 — 예전 그룹에서 기준정보 화면을 받은 직원은 관리자 콘솔에 들어간다(받은 화면만)', async () => {
  const { legacyGrants } = await import('./legacyEval');
  const { canUseAdminConsole } = await import('./engine');
  const org = { depts: [{ id: 'D1', name: '경영기획팀', parentId: null }], positions: [{ id: 'P', name: '대리', rank: 7 }] };
  const user = { id: 'u1', name: '직원', dept: '경영기획팀', position: '대리', status: '사용' };
  const group = (code: string, menuPermissions: Record<string, Record<string, boolean>>) =>
    ({ id: code, code, name: code, use: true, userIds: ['u1'], deptIds: [], positionRanks: [], members: [], menuPermissions }) as never;
  const withMon = legacyGrants(user, [group('FINANCE', { S_BASE_APMON: { access: true } })], org);
  assert.ok(canUseAdminConsole(withMon));
  assert.ok(withMon.grants.has('admin.approval.monitor') && !withMon.grants.has('admin.code.view'));
  const plain = legacyGrants(user, [group('USER', { S_GW_BOARD: { access: true, update: true } })], org);
  assert.ok(!canUseAdminConsole(plain), '업무 화면만 있으면 못 들어간다');
});
