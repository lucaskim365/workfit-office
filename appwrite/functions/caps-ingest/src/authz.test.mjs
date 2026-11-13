/**
 * 근태 서버의 새 권한 판정(authz.js)이 웹 앱 판정 엔진(resolveGrants 의 commute.view)과 같은 결과를 내는지.
 * 실행: npx tsx --test (앱 TS 엔진을 함께 불러오므로 tsx 로 돌린다)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { commuteScopeFromAuthz, toAssignment, toRole, toUser } from './authz.js';
import { resolveGrants } from '../../../../src/domain/authz/engine.ts';

const org = {
  depts: [
    { id: 'D1', name: '본부', parentId: null, headUserId: 'h1' },
    { id: 'D2', name: '개발팀', parentId: 'D1', headUserId: 'h2' },
    { id: 'D3', name: '재무팀', parentId: 'D1', headUserId: null },
    { id: 'D5', name: '플랫폼팀', parentId: 'D1', headUserId: null },
    { id: 'D4', name: '플랫폼1파트', parentId: 'D5', headUserId: null },
    { id: 'D6', name: '개발1파트', parentId: 'D2', headUserId: null },
  ],
  positions: [
    { id: 'P1', name: '이사', rank: 2 },
    { id: 'P2', name: '팀장', rank: 4 },
    { id: 'P3', name: '사원', rank: 8 },
  ],
};
const role = (id, kind, permissions = []) => ({ id, name: id, desc: '', kind, use: true, sort: 0, permissions, migratedFrom: '' });
const asg = (roleId, o) => ({ id: `${roleId}-${Math.random()}`, roleId, targetType: 'USER', targetId: '', targetSub: false, positionMode: '', scopeType: 'ALL', scopeDeptIds: [], scopeSub: true, regBy: '', regAt: '', ...o });

const roles = [
  role('SUPER', 'super'),
  role('BASE', 'base', ['commute.self']),
  role('EXEC', 'custom', ['commute.view']),
  role('HEAD', 'custom', ['commute.view']),
  role('HR', 'custom', ['commute.manage']),
  role('PICK', 'custom', ['commute.view']),
  role('OFF', 'custom', ['commute.view']),
  role('NOPE', 'custom', ['board.manage']),
];
roles.find((r) => r.id === 'OFF').use = false;
const assignments = [
  asg('SUPER', { targetType: 'DEPT', targetId: 'D5', targetSub: false }),
  asg('EXEC', { targetType: 'POSITION', targetId: 'P1', positionMode: 'GTE' }),
  asg('HEAD', { targetType: 'DEPT_HEAD', scopeType: 'OWN_DEPT', scopeSub: false }),
  asg('HR', { targetType: 'USER', targetId: 'hr' }),
  asg('PICK', { targetType: 'USER', targetId: 'pick', scopeType: 'DEPTS', scopeDeptIds: ['D2'], scopeSub: true }),
  asg('OFF', { targetType: 'USER', targetId: 'plain' }),
  asg('NOPE', { targetType: 'USER', targetId: 'plain' }),
];
const users = [
  { id: 'dev', name: '개발자', dept: '플랫폼팀', position: '사원' }, // 최고 관리자(부서 지정, 하위 없음)
  { id: 'dev1', name: '파트원', dept: '플랫폼1파트', position: '사원' }, // 하위 부서라 최고 관리자 아님
  { id: 'exec', name: '이사', dept: '본부', position: '이사' }, // 직급 이상
  { id: 'h2', name: '팀장', dept: '개발팀', position: '팀장' }, // 부서장 — 본인 부서만
  { id: 'h1', name: '본부장', dept: '본부', position: '팀장' }, // 부서장(하위 포함 아님)
  { id: 'hr', name: '인사', dept: '재무팀', position: '사원' }, // 관리 권한이 열람 포함, 전사
  { id: 'pick', name: '지정', dept: '재무팀', position: '사원' }, // 지정 조직(하위 포함)
  { id: 'plain', name: '일반', dept: '재무팀', position: '사원' }, // 꺼진 역할·무관 권한뿐
  { id: 'conc', name: '겸직', dept: '재무팀', position: '사원', assignments: [{ deptId: 'D2', role: 'HEAD' }] }, // 겸직 부서장
  { id: 'gone', name: '퇴사', dept: '개발팀', position: '사원', status: '미사용' },
];

const appScope = (u) => {
  const g = resolveGrants(u, roles, assignments, org).grants.get('commute.view');
  return !g ? 'MY_ONLY' : g.all ? 'ALL' : [...g.deptIds].sort().join(',') || 'MY_ONLY';
};
const serverScope = (u) => {
  const s = commuteScopeFromAuthz({ user: u, roles, assignments, org });
  return s.all ? 'ALL' : [...s.deptIds].sort().join(',') || 'MY_ONLY';
};

test('근태 서버 판정이 앱 엔진과 같다 — 사람·부서·직급·부서장·겸직·지정 조직·꺼진 역할·퇴사', () => {
  for (const u of users) assert.equal(serverScope(u), appScope(u), u.name);
  // 기대값도 못박아 둔다(둘 다 같이 틀리지 않게)
  const expect = { 개발자: 'ALL', 파트원: 'MY_ONLY', 이사: 'ALL', 팀장: 'D2', 본부장: 'D1', 인사: 'ALL', 지정: 'D2,D6', 일반: 'MY_ONLY', 겸직: 'D2,D3', 퇴사: 'MY_ONLY' };
  for (const u of users) assert.equal(serverScope(u), expect[u.name], u.name);
});

test('역할이 없으면(옮기기 전) null — 예전 규칙으로', () => {
  assert.equal(commuteScopeFromAuthz({ user: users[0], roles: [], assignments: [], org }), null);
});

test('전 직원 역할에 열람이 있으면 모두 전사', () => {
  const r = [role('BASE', 'base', ['commute.view'])];
  assert.equal(commuteScopeFromAuthz({ user: users[7], roles: r, assignments: [], org }).all, true);
  assert.ok(resolveGrants(users[7], r, [], org).grants.get('commute.view').all);
});

test('Appwrite 문서 변환 — JSON 글자 칸을 풀고, 부서·직급 이름은 인명관리를 앞세운다', () => {
  assert.deepEqual(toRole({ $id: 'R', kind: 'custom', use: true, permissions: '["commute.view"]' }).permissions, ['commute.view']);
  assert.deepEqual(toAssignment({ roleId: 'R', targetType: 'USER', targetId: 'u', scopeType: 'DEPTS', scopeDeptIds: '["D2"]', scopeSub: false }).scopeDeptIds, ['D2']);
  const u = toUser({ id: 'u', dept: '옛부서', position: '사원', assignments: '[{"deptId":"D3"}]' }, { dept: '개발팀', position: '팀장' });
  assert.equal(u.dept, '개발팀');
  assert.equal(u.position, '팀장');
  assert.deepEqual(u.assignments, [{ deptId: 'D3' }]);
});
