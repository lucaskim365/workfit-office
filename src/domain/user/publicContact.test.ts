import test from 'node:test';
import assert from 'node:assert/strict';
import { displayEmpNo, hasDisplayEmpNo, publicEmailOf } from './publicContact';

test('대표이사·부위원장은 로그인 ID 대신 정해진 사번을 보인다', () => {
  assert.equal(displayEmpNo({ id: 'U001', empNo: 'login-id' }), '0001');
  assert.equal(displayEmpNo({ id: 'U019', empNo: 'login-id' }), '0002');
  assert.equal(hasDisplayEmpNo({ id: 'U019' }), true);
});

test('그 외 직원은 저장된 사번 그대로이고 공개 이메일 지정이 없다', () => {
  assert.equal(displayEmpNo({ id: 'U012', empNo: '2505' }), '2505');
  assert.equal(displayEmpNo({ id: 'U012' }), '');
  assert.equal(hasDisplayEmpNo({ id: 'U012' }), false);
  assert.equal(publicEmailOf({ id: 'U012' }), null);
});

test('공개 이메일은 대표이사만 있다', () => {
  assert.equal(publicEmailOf({ id: 'U001' }), 'ceo@workfit.kr');
  assert.equal(publicEmailOf({ id: 'U019' }), null);
});
