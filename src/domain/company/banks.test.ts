import assert from 'node:assert/strict';
import test from 'node:test';
import { BANK_GROUP_CODE, BANK_GROUP_NAME, INITIAL_BANKS } from './banks';

test('초기 은행 목록 — 코드는 숫자 3자리·서로 다름, 이름도 서로 다름, 주요 은행 포함', () => {
  assert.equal(BANK_GROUP_CODE, 'BANK');
  assert.equal(BANK_GROUP_NAME, '은행');
  assert.equal(INITIAL_BANKS.length, 22);
  for (const b of INITIAL_BANKS) assert.match(b.code, /^\d{3}$/, b.name);
  assert.equal(new Set(INITIAL_BANKS.map((b) => b.code)).size, INITIAL_BANKS.length);
  assert.equal(new Set(INITIAL_BANKS.map((b) => b.name)).size, INITIAL_BANKS.length);
  for (const want of [{ code: '004', name: 'KB국민은행' }, { code: '088', name: '신한은행' }, { code: '090', name: '카카오뱅크' }]) {
    assert.ok(INITIAL_BANKS.some((b) => b.code === want.code && b.name === want.name), want.name);
  }
});
