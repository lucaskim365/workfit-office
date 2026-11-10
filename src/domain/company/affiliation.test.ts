import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companyByAffiliation, defaultDocCompany, deptCompanyOf, deptInCompanyView, userCompanies } from './affiliation';
import { hostCompanyOf } from './host';

const depts = [
  { id: 'D1', name: '대표이사', parentId: null },
  { id: 'D2', name: '개발팀', parentId: 'D1' },
  { id: 'D3', name: '루미팹', parentId: 'D1', company: 'lumefab' },
  { id: 'D4', name: '루미팹 생산팀', parentId: 'D3' },
];

test('부서의 회사 — 정하지 않으면 상위 부서를 따르고, 끝까지 없으면 워크핏(null)', () => {
  assert.equal(deptCompanyOf('D2', depts), null);
  assert.equal(deptCompanyOf('D3', depts), 'lumefab');
  assert.equal(deptCompanyOf('D4', depts), 'lumefab');
  assert.equal(deptCompanyOf(undefined, depts), null);
  // 상위가 돌고 도는 잘못된 트리에서도 멈춘다
  assert.equal(deptCompanyOf('X', [{ id: 'X', name: 'x', parentId: 'Y' }, { id: 'Y', name: 'y', parentId: 'X' }]), null);
});

test('회사를 정한 부서가 없으면 예전 방식', () => {
  assert.equal(companyByAffiliation(depts), true);
  assert.equal(companyByAffiliation(depts.map(({ company: _c, ...d }) => d)), false);
});

test('사람의 회사 — 본직이 앞, 겸직 회사가 뒤', () => {
  const members = [{ userId: 'U1', deptId: 'D4', isPrimary: false }];
  assert.deepEqual(userCompanies({ id: 'U1', dept: '개발팀' }, depts, members), [null, 'lumefab']);
  assert.deepEqual(userCompanies({ id: 'U2', dept: '루미팹 생산팀' }, depts, members), ['lumefab']);
  assert.deepEqual(userCompanies({ id: 'U3', dept: '개발팀' }, depts, members), [null]);
});

test('새 문서의 회사 — 접속한 주소의 회사가 내 회사 중에 있으면 그것, 아니면 본직', () => {
  assert.equal(defaultDocCompany([null, 'lumefab'], 'lumefab'), 'lumefab');
  assert.equal(defaultDocCompany([null, 'lumefab'], null), null);
  assert.equal(defaultDocCompany(['lumefab'], null), 'lumefab');
  assert.equal(defaultDocCompany([null], 'lumefab'), null);
});

test('조직도 회사 보기', () => {
  assert.equal(deptInCompanyView('D4', depts, 'lumefab'), true);
  assert.equal(deptInCompanyView('D2', depts, 'lumefab'), false);
  assert.equal(deptInCompanyView('D2', depts, 'workfit'), true);
  assert.equal(deptInCompanyView('D3', depts, 'all'), true);
});

test('접속 주소의 회사 — lumefab 이 든 주소나 적어 둔 주소', () => {
  assert.equal(hostCompanyOf('intra.lumefab.com'), 'lumefab');
  assert.equal(hostCompanyOf('intra.widdyax.com'), null);
  assert.equal(hostCompanyOf('localhost'), null);
  assert.equal(hostCompanyOf('lf-portal.co.kr', ['lf-portal.co.kr']), 'lumefab');
  assert.equal(hostCompanyOf('www.lf-portal.co.kr', ['lf-portal.co.kr']), 'lumefab');
  assert.equal(hostCompanyOf('notlf-portal.co.kr', ['lf-portal.co.kr']), null);
});
