import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_PUSH_TOKENS, allPushTokens, hasPushToken, withPushToken, withRecallToken, withoutPushToken } from './pushTokens';

test('목록과 예전 단일 칸을 합쳐 중복 없이 모은다', () => {
  assert.deepEqual(allPushTokens({ fcmTokens: ['a', 'b'], fcmToken: 'b' }), ['a', 'b']);
  assert.deepEqual(allPushTokens({ fcmTokens: [], fcmToken: 'old' }), ['old']);
  assert.deepEqual(allPushTokens({}), []);
});

test('새 기기 토큰은 맨 앞에 넣고 예전 단일 칸 토큰도 목록으로 옮긴다', () => {
  assert.deepEqual(withPushToken({ fcmTokens: [], fcmToken: 'pc' }, 'phone'), ['phone', 'pc']);
  assert.deepEqual(withPushToken({ fcmTokens: ['pc', 'phone'], fcmToken: 'pc' }, 'phone'), ['phone', 'pc']);
});

test('기기 수 상한을 넘으면 가장 오래된 것부터 뺀다', () => {
  const many = Array.from({ length: MAX_PUSH_TOKENS }, (_, i) => `t${i}`);
  const next = withPushToken({ fcmTokens: many }, 'new');
  assert.equal(next.length, MAX_PUSH_TOKENS);
  assert.equal(next[0], 'new');
  assert.equal(next.includes(`t${MAX_PUSH_TOKENS - 1}`), false);
});

test('토큰을 빼면 목록과 단일 칸에서 모두 빠진다', () => {
  assert.deepEqual(withoutPushToken({ fcmTokens: ['a', 'b'], fcmToken: 'a' }, 'a'), { fcmTokens: ['b'], fcmToken: '' });
  assert.deepEqual(withoutPushToken({ fcmTokens: ['a', 'b'], fcmToken: 'b' }, 'a'), { fcmTokens: ['b'], fcmToken: 'b' });
  assert.equal(hasPushToken({ fcmTokens: ['a'], fcmToken: '' }, 'a'), true);
  assert.equal(hasPushToken({ fcmTokens: ['a'], fcmToken: '' }, ''), false);
});

test('회수 신호 목록 — 아이폰이 아닌 기기만 맨 앞에 넣고, 아이폰이면(또는 바뀌면) 뺀다', () => {
  assert.deepEqual(withRecallToken([], 'android', true), ['android']);
  assert.deepEqual(withRecallToken(['pc'], 'android', true), ['android', 'pc']);
  assert.deepEqual(withRecallToken(['pc', 'iphone'], 'iphone', false), ['pc']);
  assert.deepEqual(withRecallToken(null, 'iphone', false), []);
});
