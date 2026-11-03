import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeOrder, moveItem } from './groupwarePrefs';

const IDS = ['a', 'b', 'c', 'd'] as const;

test('저장한 순서가 없으면 기본 순서', () => {
  assert.deepEqual(mergeOrder(null, IDS), ['a', 'b', 'c', 'd']);
});

test('저장한 순서를 지키고 새 메뉴는 뒤에 붙인다', () => {
  assert.deepEqual(mergeOrder(['c', 'a'], IDS), ['c', 'a', 'b', 'd']);
});

test('없어진 메뉴와 중복은 뺀다', () => {
  assert.deepEqual(mergeOrder(['x', 'b', 'b', 'a'], IDS), ['b', 'a', 'c', 'd']);
});

test('앞으로도 뒤로도 옮긴다', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 'd', 'b'), ['a', 'd', 'b', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 'a', 'c'), ['b', 'c', 'a', 'd']);
});

test('없는 메뉴를 옮기면 그대로', () => {
  const order = ['a', 'b'];
  assert.equal(moveItem(order, 'a', 'x'), order);
  assert.equal(moveItem(order, 'a', 'a'), order);
});
