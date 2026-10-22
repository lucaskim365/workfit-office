import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, parseSheet, serializeSheet, recalculate, sheetSignature, cellKey, type Sheet } from './model';
import { colIndex } from './formula';

/** 값 표와 A1 표기 수식으로 시트 만들기 */
function fill(values: string[][], formulas: Record<string, string> = {}): Sheet {
  const width = Math.max(...values.map((r) => r.length), 1);
  const s = createSheet(values.length, width);
  values.forEach((row, r) => row.forEach((v, c) => (s.rows[r][s.cols[c]] = v)));
  Object.entries(formulas).forEach(([addr, f]) => {
    const m = addr.match(/^([A-Z]+)(\d+)$/)!;
    s.formulas[cellKey(Number(m[2]) - 1, s.cols[colIndex(m[1])])] = f;
  });
  return s;
}
const val = (s: Sheet, r: number, c: number) => s.rows[r][s.cols[c]];

test('createSheet 기본 크기와 빈 맵', () => {
  const s = createSheet();
  assert.equal(s.version, 1);
  assert.equal(s.rows.length, 30);
  assert.equal(new Set(s.cols).size, 8);
  assert.ok(s.cols.every((k) => /^c_[a-z0-9]{6}$/.test(k)));
  assert.deepEqual([s.cellMeta, s.rowMeta, s.colMeta, s.formulas], [{}, {}, {}, {}]);
});

test('parseSheet — 다른 형식·깨진 값은 null, 저장 왕복', () => {
  assert.equal(parseSheet('{"version":2,"cols":["a"],"rows":[]}'), null);
  assert.equal(parseSheet('not json'), null);
  assert.equal(parseSheet(undefined), null);
  const s = { ...createSheet(2, 2), cellMeta: { name: { '0:x': 'amount' } } };
  assert.deepEqual(parseSheet(serializeSheet(s)), s);
  const partial = parseSheet(JSON.stringify({ version: 1, cols: ['x'], rows: [{ x: '1' }] }))!;
  assert.deepEqual([partial.cellMeta, partial.rowHeights, partial.merges], [{}, {}, []]);
});

test('재계산 — 연쇄·IF·오류', () => {
  const s = fill(
    [
      ['10', '20', ''],
      ['', '', ''],
    ],
    { C1: '=A1+B1', A2: '=C1*2', B2: '=IF(A2>50,"초과","이내")', C2: '=A1+"x"' }
  );
  const r = recalculate(s);
  assert.equal(val(r, 0, 2), '30');
  assert.equal(val(r, 1, 0), '60');
  assert.equal(val(r, 1, 1), '초과');
  assert.equal(val(r, 1, 2), '#오류');
  assert.equal(val(s, 0, 2), ''); // 입력 불변
});

test('순환 참조는 0', () => {
  const r = recalculate(fill([['', '']], { A1: '=B1', B1: '=A1+1' }));
  assert.equal(val(r, 0, 1), '1');
});

test('오류 칸을 참조하면 오류', () => {
  const r = recalculate(fill([['', '']], { A1: '="x"+1', B1: '=A1*2' }));
  assert.equal(val(r, 0, 1), '#오류');
});

test('병합에 가려진 칸은 빈 칸', () => {
  const s = fill([['', '5', '']], { C1: '=B1+1' });
  s.merges = [{ startRow: 0, startCol: 0, rowSpan: 1, colSpan: 2 }];
  assert.equal(val(recalculate(s), 0, 2), '1');
});

test('sheetSignature — 값·너비엔 그대로, 부가 정보엔 바뀜', () => {
  const s = createSheet(2, 2);
  const sig = sheetSignature(s);
  assert.equal(
    sheetSignature({ ...s, rows: [{ ...s.rows[0], [s.cols[0]]: '값' }, s.rows[1]], colWidths: { [s.cols[0]]: 200 } }),
    sig
  );
  assert.notEqual(sheetSignature({ ...s, cellMeta: { name: { [cellKey(0, s.cols[0])]: 'amount' } } }), sig);
});
