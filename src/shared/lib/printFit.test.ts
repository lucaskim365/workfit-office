import assert from 'node:assert/strict';
import test from 'node:test';
import { choosePrintFitLevel } from './printFit';

/** 단계별 장 수 표로 고르기 */
const pick = (pages: number[]) => choosePrintFitLevel((i) => pages[i], pages.length);

test('그대로 한 장이면 손대지 않는다(9pt)', () => {
  assert.equal(pick([0.8, 0.7, 0.6]), 0);
  assert.equal(pick([1, 0.9, 0.8]), 0);
});

test('둘째 장이 조금 넘치면 간격 좁히기부터', () => {
  assert.equal(pick([1.1, 0.98, 0.9]), 1);
});

test('간격만으로 모자라면 8pt 까지', () => {
  assert.equal(pick([1.15, 1.05, 0.97]), 2);
});

test('8pt 로도 안 들어가면 그대로 여러 장', () => {
  assert.equal(pick([1.19, 1.12, 1.03]), 0);
});

test('둘째 장이 20% 이상이면 줄이지 않는다', () => {
  assert.equal(pick([1.2, 0.9, 0.8]), 0);
  assert.equal(pick([2.5, 2, 1.8]), 0);
});

test('높이를 못 재면 그대로', () => {
  assert.equal(pick([0, 0, 0]), 0);
  assert.equal(pick([Number.NaN, 1, 1]), 0);
});
