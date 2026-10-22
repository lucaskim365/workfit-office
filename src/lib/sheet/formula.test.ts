import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateFormula,
  FormulaError,
  parseNumber,
  valueText,
  colLetter,
  colIndex,
  type CellGetter,
} from './formula';

const grid = [
  ['10', '20', ''],
  ['A', '1,200', '₩3,000'],
];
const get: CellGetter = (r, c) => grid[r]?.[c] ?? '';

test('사칙연산과 우선순위', () => {
  assert.equal(evaluateFormula('=A1+B1*2', get), 50);
  assert.equal(evaluateFormula('=(A1+B1)/3', get), 10);
  assert.equal(evaluateFormula('=-A1+5', get), -5);
  assert.equal(evaluateFormula('=A1/0', get), 0);
});

test('빈 칸과 콤마 숫자', () => {
  assert.equal(evaluateFormula('=C1+1', get), 1);
  assert.equal(evaluateFormula('=B2+C2', get), 4200);
  assert.equal(evaluateFormula('="["&C1&"]"', get), '[]');
});

test('글자 산술은 오류', () => {
  assert.throws(() => evaluateFormula('=A2+1', get), FormulaError);
});

test('함수와 범위 — 범위 안 글자는 건너뜀', () => {
  assert.equal(evaluateFormula('=SUM(A1:C2)', get), 4230);
  assert.equal(evaluateFormula('=average(A1:B1)', get), 15);
  assert.equal(evaluateFormula('=MAX(A1,B1,5)', get), 20);
  assert.equal(evaluateFormula('=ROUND(10/3,2)', get), 3.33);
  assert.equal(evaluateFormula('=SUM(C1:C1)', get), 0);
});

test('비교와 IF', () => {
  assert.equal(evaluateFormula('=A1<B1', get), true);
  assert.equal(evaluateFormula('=A2="a"', get), true);
  assert.equal(evaluateFormula('=A1<>10', get), false);
  assert.equal(evaluateFormula('=IF(B1>A1,"큼","작음")', get), '큼');
  assert.equal(evaluateFormula('=IF(A1>B1,"큼")', get), '');
  assert.equal(evaluateFormula('=IF(C1,1,2)', get), 2);
});

test('결합', () => {
  assert.equal(evaluateFormula('=A1&"원"', get), '10원');
  assert.equal(evaluateFormula('=A1+B1&"원"', get), '30원');
  assert.equal(evaluateFormula('="say ""hi"""', get), 'say "hi"');
});

test('문자열 안의 주소는 참조가 아니다', () => {
  assert.equal(evaluateFormula('="A1 참조"', get), 'A1 참조');
});

test('절대 참조', () => {
  assert.equal(evaluateFormula('=$A$1+A$1+$B1', get), 40);
});

test('잘못된 식', () => {
  for (const e of ['=SUM(', '=A1+', '=FOO(1)', '=#REF!+1', '=A1 B1', '=VLOOKUP(A1,A1:B2,2)', '=A1:B2']) {
    assert.throws(() => evaluateFormula(e, get), FormulaError, e);
  }
});

test('숫자 해석·표시·열 문자', () => {
  assert.equal(parseNumber(' 1,200 '), 1200);
  assert.equal(parseNumber('10%'), 0.1);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('abc'), null);
  assert.equal(valueText(0.1 + 0.2), '0.3');
  assert.equal(valueText(true), 'TRUE');
  assert.equal(colLetter(26), 'AA');
  assert.equal(colIndex('AA'), 26);
});
