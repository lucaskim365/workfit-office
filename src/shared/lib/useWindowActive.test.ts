import assert from 'node:assert/strict';
import test from 'node:test';
import { isWindowActive } from './useWindowActive';

const doc = (visibilityState: DocumentVisibilityState, focused: boolean) => ({ visibilityState, hasFocus: () => focused });

test('화면에 보이고 포커스가 있으면 보고 있는 것이다', () => {
  assert.equal(isWindowActive(doc('visible', true)), true);
});

test('다른 프로그램을 보고 있으면 화면에 보여도 아니다', () => {
  assert.equal(isWindowActive(doc('visible', false)), false);
});

test('다른 탭이거나 창을 내렸으면 아니다', () => {
  assert.equal(isWindowActive(doc('hidden', false)), false);
  assert.equal(isWindowActive(doc('hidden', true)), false);
});
