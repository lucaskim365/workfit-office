import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateFormula,
  FormulaError,
  parseNumber,
  valueText,
  colLetter,
  colIndex,
  shiftFormula,
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

test('행 삽입·삭제 이동', () => {
  assert.equal(shiftFormula('=A1+A3', { type: 'row_add', atIndex: 1 }), '=A1+A4');
  assert.equal(shiftFormula('=SUM(B2:B4)', { type: 'row_add', atIndex: 4 }), '=SUM(B2:B5)');
  assert.equal(shiftFormula('=A2*2', { type: 'row_del', atIndex: 1 }), '=#REF!*2');
  assert.equal(shiftFormula('=SUM(A2:A2)', { type: 'row_del', atIndex: 1 }), '=SUM(#REF!)');
});

test('열 이동', () => {
  assert.equal(shiftFormula('=B1&C1', { type: 'col_add', atIndex: 1 }), '=C1&D1');
  assert.equal(shiftFormula('=C1', { type: 'col_del', atIndex: 0 }), '=B1');
});

test('절대 참조 이동 시 $ 보존', () => {
  assert.equal(shiftFormula('=$A$2+A$2', { type: 'row_add', atIndex: 0 }), '=$A$3+A$3');
});

test('문자열 안 주소는 이동하지 않는다', () => {
  assert.equal(shiftFormula('=IF(A2>0,"A2 확인","")', { type: 'row_add', atIndex: 0 }), '=IF(A3>0,"A2 확인","")');
});

test('함수 이름·공백 보존, 깨진 식은 그대로', () => {
  assert.equal(shiftFormula('=round( A1 , 2 )', { type: 'row_add', atIndex: 0 }), '=round( A2 , 2 )');
  assert.equal(shiftFormula('="열린 따옴표', { type: 'row_add', atIndex: 0 }), '="열린 따옴표');
});

test('0을 입력한 칸은 빈 글자와 같지 않다 (빈 칸만 같다)', () => {
  const g = [['0', '']];
  const gg: CellGetter = (r, c) => g[r]?.[c] ?? '';
  assert.equal(evaluateFormula('=A1=""', gg), false);
  assert.equal(evaluateFormula('=B1=""', gg), true);
  assert.equal(evaluateFormula('=B1=0', gg), true);
  assert.equal(evaluateFormula('=A1=0', gg), true);
});

test('결합은 칸 글자를 그대로 쓴다', () => {
  const g = [['007', '₩3,000', '50%']];
  const gg: CellGetter = (r, c) => g[r]?.[c] ?? '';
  assert.equal(evaluateFormula('=A1&"-"', gg), '007-');
  assert.equal(evaluateFormula('=B1&""', gg), '₩3,000');
  assert.equal(evaluateFormula('=C1&""', gg), '50%');
  assert.equal(evaluateFormula('=A1+1', gg), 8);
  assert.equal(evaluateFormula('=B1*2', gg), 6000);
});

test('숫자 해석 — 콤마는 세 자리 묶음만, 중간 공백은 숫자 아님', () => {
  assert.equal(parseNumber('010 1234 5678'), null);
  assert.equal(parseNumber('1,2,3'), null);
  assert.equal(parseNumber('12,345,678.5'), 12345678.5);
  assert.equal(parseNumber('₩3,000'), 3000);
  const g = [['010 1234 5678', '5']];
  assert.equal(evaluateFormula('=SUM(A1:B1)', (r, c) => g[r]?.[c] ?? ''), 5);
});

test('엑셀 연산 — %·^·우선순위', () => {
  assert.equal(evaluateFormula('=A1*10%', get), 1);
  assert.equal(evaluateFormula('=50%%', get), 0.005);
  assert.equal(evaluateFormula('=2^3', get), 8);
  assert.equal(evaluateFormula('=-2^2', get), 4);
  assert.equal(evaluateFormula('=2^3^2', get), 64);
  assert.equal(evaluateFormula('=1+2*3^2', get), 19);
  assert.equal(evaluateFormula('=(1+1)%', get), 0.02);
});

test('추가 함수 — COUNT·COUNTA·SUMIF·ROUNDUP·ROUNDDOWN·ABS·IFERROR', () => {
  assert.equal(evaluateFormula('=COUNT(A1:C2)', get), 4); // 10·20·1,200·₩3,000
  assert.equal(evaluateFormula('=COUNTA(A1:C2)', get), 5); // 빈 칸 1개 제외
  assert.equal(evaluateFormula('=SUMIF(A1:B1,">15")', get), 20);
  assert.equal(evaluateFormula('=SUMIF(A2:A2,"A",B2:B2)', get), 1200);
  assert.equal(evaluateFormula('=SUMIF(A1:B1,10)', get), 10);
  assert.equal(evaluateFormula('=ROUNDUP(1.21,1)', get), 1.3);
  assert.equal(evaluateFormula('=ROUNDDOWN(-1.29,1)', get), -1.2);
  assert.equal(evaluateFormula('=ROUNDUP(1234,-2)', get), 1300);
  assert.equal(evaluateFormula('=ABS(-A1)', get), 10);
  assert.equal(evaluateFormula('=IFERROR(A2+1,"없음")', get), '없음');
  assert.equal(evaluateFormula('=IFERROR(A1+1,0)', get), 11);
  assert.throws(() => evaluateFormula('=SUMIF(A1,1)', get), FormulaError);
});

test('행 추가 시 ^·% 가 든 수식도 참조만 옮김', () => {
  assert.equal(shiftFormula('=A2^2*10%', { type: 'row_add', atIndex: 0 }), '=A3^2*10%');
});

test('TODAY — 오늘 날짜 글자, 인자는 받지 않음', () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  assert.equal(evaluateFormula('=TODAY()', () => ''), `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  assert.throws(() => evaluateFormula('=TODAY(1)', () => ''));
});
