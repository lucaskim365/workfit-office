import assert from 'node:assert/strict';
import test from 'node:test';
import { DOC_WIDTH_PX, PAGE_H_PX, PAGE_W_PX, printFitZoom } from './printFit';

const base = PAGE_W_PX / DOC_WIDTH_PX;
/** 폭 맞춤 배율로 찍었을 때 몇 장인지 → 높이 비율 */
const ratioForPages = (pages: number) => (PAGE_H_PX * pages) / base / DOC_WIDTH_PX;

test('한 장에 들어가는 문서는 A4 폭 맞춤 배율 그대로', () => {
  assert.equal(printFitZoom(ratioForPages(0.7)), base);
});

test('둘째 장이 20% 미만이면 한 장에 들어가게 더 줄인다', () => {
  const r = ratioForPages(1.15);
  const z = printFitZoom(r);
  assert.ok(z < base);
  assert.ok(Math.abs(DOC_WIDTH_PX * r * z - PAGE_H_PX) < 1e-6);
});

test('둘째 장이 20% 이상이면 줄이지 않고 여러 장으로', () => {
  assert.equal(printFitZoom(ratioForPages(1.3)), base);
  assert.equal(printFitZoom(ratioForPages(3)), base);
});

test('높이를 못 재면 폭 맞춤', () => {
  assert.equal(printFitZoom(0), base);
  assert.equal(printFitZoom(Number.NaN), base);
});
