import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canOnUser, canUseAdminConsole, resolveGrants, type AuthzOrg } from './engine';
import { LEGACY_MAP, convertLegacy } from './legacy';
import { PERMISSION_BY_KEY, PERMISSIONS } from './permissions';
import type { AuthAssignment, AuthRole } from './types';

const org: AuthzOrg = {
  depts: [
    { id: 'D1', name: '본부', parentId: null, headUserId: 'boss' },
    { id: 'D2', name: '1팀', parentId: 'D1', headUserId: 'lead' },
    { id: 'D3', name: '2팀', parentId: 'D1' },
  ],
  positions: [
    { id: 'P1', name: '이사', rank: 3 },
    { id: 'P2', name: '부장', rank: 4 },
    { id: 'P3', name: '사원', rank: 9 },
  ],
};
const u = (id: string, dept: string, position: string) => ({ id, name: id, dept, position, status: '사용' });
const boss = u('boss', '본부', '이사');
const lead = u('lead', '1팀', '부장');
const staff1 = u('s1', '1팀', '사원');
const staff2 = u('s2', '2팀', '사원');

const role = (id: string, permissions: string[], kind: AuthRole['kind'] = 'custom'): AuthRole => ({ id, name: id, desc: '', permissions, kind, use: true, sort: 1 });
const asg = (roleId: string, p: Partial<AuthAssignment>): AuthAssignment => ({ id: Math.random().toString(36), roleId, targetType: 'USER', targetId: '', targetSub: false, positionMode: 'EQ', scopeType: 'ALL', scopeDeptIds: [], scopeSub: true, ...p });

test('전 직원 역할은 모두에게, 콘솔 권한은 걸러진다', () => {
  const r = resolveGrants(staff1, [role('B', ['board.use', 'admin.code.view'], 'base')], [], org);
  assert.ok(r.grants.has('board.use'));
  assert.ok(!r.grants.has('admin.code.view'));
  assert.equal(canUseAdminConsole(r), false);
});

test('부서장 지정 + 본인 소속 부서 범위 — 자기 부서(하위 포함)만', () => {
  const roles = [role('H', ['commute.view'])];
  const as = [asg('H', { targetType: 'DEPT_HEAD', scopeType: 'OWN_DEPT' })];
  const rl = resolveGrants(lead, roles, as, org);
  assert.ok(canOnUser(rl, 'commute.view', staff1, org));
  assert.ok(!canOnUser(rl, 'commute.view', staff2, org));
  const rb = resolveGrants(boss, roles, as, org);
  assert.ok(canOnUser(rb, 'commute.view', staff2, org), '본부장은 하위 팀까지');
  assert.equal(resolveGrants(staff1, roles, as, org).grants.size, 0);
});

test('직급 이상 지정, 부서 하위 포함 지정', () => {
  const roles = [role('E', ['calendar.company'])];
  assert.ok(resolveGrants(boss, roles, [asg('E', { targetType: 'POSITION', targetId: 'P2', positionMode: 'GTE' })], org).grants.has('calendar.company'));
  assert.ok(!resolveGrants(staff1, roles, [asg('E', { targetType: 'POSITION', targetId: 'P2', positionMode: 'GTE' })], org).grants.has('calendar.company'));
  assert.ok(!resolveGrants(boss, roles, [asg('E', { targetType: 'POSITION', targetId: 'P2' })], org).grants.has('calendar.company'));
  assert.ok(resolveGrants(staff2, roles, [asg('E', { targetType: 'DEPT', targetId: 'D1', targetSub: true })], org).grants.has('calendar.company'));
  assert.ok(!resolveGrants(staff2, roles, [asg('E', { targetType: 'DEPT', targetId: 'D1' })], org).grants.has('calendar.company'));
});

test('최고 관리자 — 콘솔 권한 전부, 업무 데이터 권한은 없음, 관리는 보기를 포함', () => {
  const r = resolveGrants(staff1, [role('S', [], 'super')], [asg('S', { targetId: 's1' })], org);
  assert.ok(r.isSuperAdmin);
  assert.ok(r.grants.has('admin.authz'));
  assert.ok(!r.grants.has('commute.view'));
  const c = resolveGrants(staff1, [role('C', ['admin.code.manage', 'admin.backup'])], [asg('C', { targetId: 's1' })], org);
  assert.ok(c.grants.has('admin.code.view'));
  assert.ok(!c.grants.has('admin.backup'), '최고 관리자 전용은 일반 역할로 못 준다');
  assert.ok(canUseAdminConsole(c));
});

test('미사용 직원·꺼진 역할은 권한 없음', () => {
  const roles = [role('B', ['board.use'], 'base')];
  assert.equal(resolveGrants({ ...staff1, status: '미사용' }, roles, [], org).grants.size, 0);
  assert.equal(resolveGrants(staff1, [{ ...roles[0], use: false }], [], org).grants.size, 0);
});

test('옛 대응표의 권한 키는 모두 권한 목록에 있다', () => {
  for (const row of Object.values(LEGACY_MAP)) for (const keys of Object.values(row)) for (const k of keys ?? []) assert.ok(PERMISSION_BY_KEY.has(k), k);
  assert.equal(new Set(PERMISSIONS.map((p) => p.key)).size, PERMISSIONS.length, '키 중복 없음');
});

test('옛 그룹 변환 — 최고 관리자 대상, 전 직원 권한은 다른 역할에서 빠짐, 부서장 규칙', () => {
  const groups = [
    { code: 'ADMIN', name: '관리자', desc: '', use: true, isSystem: true, userIds: [], deptIds: ['D2'], positionRanks: [], menuPermissions: {}, members: [] },
    { code: 'USER', name: '일반사원', desc: '', use: true, isSystem: true, userIds: [], deptIds: [], positionRanks: [], menuPermissions: { S_GW_BOARD: { access: true, create: true, update: false, delete: false } }, members: [] },
    { code: 'FIN', name: '재무', desc: '', use: true, isSystem: false, userIds: ['s2'], deptIds: [], positionRanks: [], menuPermissions: { S_GW_BOARD: { access: true, create: false, update: false, delete: false }, S_BASE_CODE: { access: true, create: false, update: true, delete: false } }, members: [] },
  ];
  const { roles, assignments } = convertLegacy(groups as never, { ...org, positions: [{ ...org.positions[0], isExecutiveRole: true }, ...org.positions.slice(1)] }, [staff1, staff2, lead, boss]);
  const fin = roles.find((r) => r.name === '재무')!;
  assert.deepEqual(fin.permissions, ['admin.code.manage', 'admin.code.view']);
  assert.ok(resolveGrants(lead, roles, assignments, org).isSuperAdmin, '1팀은 최고 관리자');
  assert.ok(resolveGrants(boss, roles, assignments, org).grants.has('approval.secure'), '임원 직급');
  assert.ok(canOnUser(resolveGrants(lead, roles, assignments, org), 'commute.view', staff1, org), '부서장 근태');
});
