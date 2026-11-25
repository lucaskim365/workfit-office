import assert from 'node:assert/strict';
import test from 'node:test';
import { referenceUserIdsOf } from './schema';

test('기본 참조 사용자 — 여러 명 칸이 우선, 비었으면 예전 한 명 칸', () => {
  assert.deepEqual(referenceUserIdsOf(null), []);
  assert.deepEqual(referenceUserIdsOf({}), []);
  // 예전에 저장한 서식 — DB 가 여러 명 칸을 빈 목록으로 돌려줘도 한 명 칸을 읽는다
  assert.deepEqual(referenceUserIdsOf({ referenceUserId: 'u1', referenceUserIds: [] }), ['u1']);
  assert.deepEqual(referenceUserIdsOf({ referenceUserId: 'u1' }), ['u1']);
  assert.deepEqual(referenceUserIdsOf({ referenceUserId: 'u1', referenceUserIds: ['u1', 'u2', 'u1', ''] }), ['u1', 'u2']);
  // 모두 뺀 서식 — 한 명 칸도 같이 비운다
  assert.deepEqual(referenceUserIdsOf({ referenceUserId: null, referenceUserIds: [] }), []);
});
