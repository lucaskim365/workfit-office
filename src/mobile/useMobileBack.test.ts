import assert from 'node:assert/strict';
import test from 'node:test';
import { canGoBackInApp } from './useMobileBack';

test('앱에서 처음 연 화면이면 돌아갈 곳이 없다', () => {
  assert.equal(canGoBackInApp({ idx: 0, key: 'a' }), false);
});

test('앱 안에서 들어온 화면이면 돌아갈 수 있다', () => {
  assert.equal(canGoBackInApp({ idx: 2, key: 'a' }), true);
});

test('라우터 기록이 없으면 돌아갈 곳이 없는 것으로 본다', () => {
  assert.equal(canGoBackInApp(null), false);
  assert.equal(canGoBackInApp({}), false);
});
