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

test('옮기기 — 최고 관리자의 업무 권한은 의도한 차이로만 나온다', () => {
  const plan = planMigration(groups as never, org, users);
  const adm = plan.rows.find((r) => r.user.id === 'adm')!;
  assert.deepEqual([adm.missing, adm.extra, adm.scopeChanged], [[], [], []]);
  assert.ok(adm.superOnly.includes('approval.secure'));
});

test('옛 판정 — 부서장은 본인 부서 근태만, 임원은 전사', () => {
  const lead = legacyGrants(users[1], groups as never, org).grants.get('commute.view')!;
  assert.equal(lead.all, false);
  assert.ok(lead.deptIds.has('D2'));
  assert.equal(legacyGrants(users[0], groups as never, org).grants.get('commute.view')?.all, true);
  assert.equal(legacyGrants(users[2], groups as never, org).grants.has('commute.view'), false);
});
