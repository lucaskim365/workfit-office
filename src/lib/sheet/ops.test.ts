import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sheet } from './model';
import {
  insertRow,
  deleteRow,
  insertCol,
  deleteCol,
  mergeRange,
  unmergeAt,
  setCellValue,
  applyStyle,
  applyBorder,
  pasteTsv,
  setCellMeta,
  setRowMeta,
  setColMeta,
} from './ops';

/** 열 키를 A·B·C로 고정한 시트 — 값은 "열키+행번호" */
function sheet(rowCount: number, cols = ['A', 'B', 'C'], extra: Partial<Sheet> = {}): Sheet {
  return {
    version: 1,
    cols,
    rows: Array.from({ length: rowCount }, (_, r) => Object.fromEntries(cols.map((c) => [c, `${c}${r}`]))),
    colWidths: {},
    rowHeights: {},
    merges: [],
    formulas: {},
    styles: {},
    cellMeta: {},
    rowMeta: {},
    colMeta: {},
    ...extra,
  };
}

test('행 삽입 시 수식·서식 이동, 입력 불변', () => {
  const p = sheet(3, ['A', 'B', 'C'], {
    formulas: { '2:A': '=A1+A2' },
    styles: { '0:A': { bold: true }, '2:B': { bg: '#ff0000' } },
  });
  const n = insertRow(p, 1);
  assert.equal(n.rows.length, 4);
  assert.deepEqual(n.rows[1], { A: '', B: '', C: '' });
  assert.deepEqual(n.formulas, { '3:A': '=A1+A3' });
  assert.deepEqual(n.styles, { '0:A': { bold: true }, '3:B': { bg: '#ff0000' } });
  assert.equal(p.rows.length, 3);
});

test('열 삭제 시 병합 축소·수식 이동·너비 제거', () => {
  const p = sheet(2, ['A', 'B', 'C', 'D'], {
    merges: [{ startRow: 0, startCol: 0, rowSpan: 1, colSpan: 3 }],
    formulas: { '1:D': '=C1+B1' },
    colWidths: { B: 90 },
  });
  const n = deleteCol(p, 1);
  assert.deepEqual(n.cols, ['A', 'C', 'D']);
  assert.deepEqual(n.merges, [{ startRow: 0, startCol: 0, rowSpan: 1, colSpan: 2 }]);
  assert.deepEqual(n.formulas, { '1:D': '=B1+#REF!' });
  assert.equal(n.colWidths.B, undefined);
  assert.equal('B' in n.rows[0], false);
  assert.deepEqual(deleteCol(deleteCol(p, 1), 1).merges, []); // 한 칸만 남으면 해제
});

test('열 삽입은 보이지 않는 새 키', () => {
  const n = insertCol(sheet(2, ['A', 'B']), 1);
  assert.equal(n.cols.length, 3);
  assert.match(n.cols[1], /^c_[a-z0-9]{6}$/);
  assert.equal(n.rows[0][n.cols[1]], '');
});

test('병합은 대표 칸 값만 남기고 걸친 병합을 흡수, 해제', () => {
  const p = sheet(3, ['A', 'B', 'C'], {
    merges: [{ startRow: 1, startCol: 1, rowSpan: 1, colSpan: 2 }],
    formulas: { '1:B': '=1' },
  });
  const n = mergeRange(p, { r1: 0, c1: 0, r2: 1, c2: 2 });
  assert.deepEqual(n.merges, [{ startRow: 0, startCol: 0, rowSpan: 2, colSpan: 3 }]);
  assert.equal(n.rows[0].A, 'A0');
  assert.equal(n.rows[0].B, '');
  assert.equal(n.rows[1].C, '');
  assert.equal(n.rows[2].A, 'A2');
  assert.deepEqual(n.formulas, {});
  assert.deepEqual(unmergeAt(n, 1, 1).merges, []);
});

test('서식·테두리', () => {
  const p = sheet(2, ['A', 'B']);
  const s = applyStyle(p, { r1: 0, c1: 0, r2: 1, c2: 0 }, { bold: true, align: 'right' });
  assert.deepEqual(s.styles['0:A'], { bold: true, align: 'right' });
  assert.deepEqual(s.styles['1:A'], { bold: true, align: 'right' });
  assert.equal(s.styles['0:B'], undefined);
  assert.equal(applyStyle(s, { r1: 0, c1: 0, r2: 0, c2: 0 }, { bold: undefined, align: undefined }).styles['0:A'], undefined);

  const all = { r1: 0, c1: 0, r2: 1, c2: 1 };
  assert.deepEqual(applyBorder(p, all, 'outer').styles['0:A'].border, { t: 'thin', l: 'thin' });
  assert.deepEqual(applyBorder(p, all, 'outer').styles['1:B'].border, { b: 'thin', r: 'thin' });
  assert.deepEqual(applyBorder(p, all, 'thickOuter').styles['0:B'].border, { t: 'thick', r: 'thick' });
  const every = applyBorder(p, all, 'all');
  assert.deepEqual(every.styles['1:A'].border, { t: 'thin', r: 'thin', b: 'thin', l: 'thin' });
  assert.deepEqual(applyBorder(every, all, 'none').styles['0:A'].border, { t: 'none', r: 'none', b: 'none', l: 'none' });
});

test('붙여넣기는 넘치면 행·열을 늘리고 기존 수식을 지움', () => {
  const n = pasteTsv(sheet(2, ['A', 'B']), 1, 1, 'a\tb\r\nc\td\r\n');
  assert.equal(n.rows.length, 3);
  assert.equal(n.cols.length, 3);
  assert.equal(n.rows[1].B, 'a');
  assert.equal(n.rows[1][n.cols[2]], 'b');
  assert.equal(n.rows[2][n.cols[2]], 'd');
  assert.equal(n.rows[0].A, 'A0');
  assert.deepEqual(pasteTsv(sheet(1, ['A'], { formulas: { '0:A': '=1' } }), 0, 0, 'x').formulas, {});
});

test('값 입력 — = 로 시작하면 수식, allowFormula false면 값', () => {
  const p = sheet(1, ['A', 'B']);
  const f = setCellValue(p, 0, 1, '=A1*2');
  assert.equal(f.formulas['0:B'], '=A1*2');
  const t = setCellValue(f, 0, 1, 'abc');
  assert.equal(t.formulas['0:B'], undefined);
  assert.equal(t.rows[0].B, 'abc');
  const lit = setCellValue(f, 0, 1, '=1+1', { allowFormula: false });
  assert.equal(lit.rows[0].B, '=1+1');
  assert.equal(lit.formulas['0:B'], undefined);
});

test('행 삽입 시 부가 정보 이동', () => {
  const s = sheet(3, ['a', 'b'], {
    rowHeights: { '1': 40 },
    rowMeta: { secret: { '2': true } },
    cellMeta: { name: { '1:a': 'amount' }, lock: { '0:a': true, '2:a': true } },
    formulas: { '0:b': '=A2*2' },
  });
  const n = insertRow(s, 1);
  assert.deepEqual(n.rowHeights, { '2': 40 });
  assert.deepEqual(n.rowMeta, { secret: { '3': true } });
  assert.deepEqual(n.cellMeta, { name: { '2:a': 'amount' }, lock: { '0:a': true, '3:a': true } });
  assert.equal(n.formulas['0:b'], '=A3*2');
  assert.deepEqual(s.rowHeights, { '1': 40 }); // 입력 불변
});

test('행·열 삭제 시 부가 정보 제거', () => {
  const s = sheet(3, ['a', 'b'], {
    rowHeights: { '1': 40 },
    rowMeta: { secret: { '2': true } },
    cellMeta: { name: { '1:a': 'amount' }, lock: { '0:a': true, '0:b': true } },
    colMeta: { secret: { a: true } },
    colWidths: { a: 120 },
  });
  const r = deleteRow(s, 1);
  assert.deepEqual(r.rowHeights, {});
  assert.deepEqual(r.rowMeta, { secret: { '1': true } });
  assert.deepEqual(r.cellMeta, { lock: { '0:a': true, '0:b': true } });
  const c = deleteCol(s, 0);
  assert.deepEqual(c.cellMeta, { lock: { '0:b': true } });
  assert.deepEqual(c.colMeta, {});
  assert.deepEqual(c.colWidths, {});
});

test('문자열 안 주소는 행 삽입에도 그대로', () => {
  const n = insertRow(sheet(2, ['a', 'b'], { formulas: { '0:b': '="A2"&A2' } }), 0);
  assert.equal(n.formulas['1:b'], '="A2"&A3');
});

test('부가 정보 설정·삭제', () => {
  const s = sheet(2, ['a', 'b']);
  const on = setCellMeta(s, 'name', 0, 0, 'amount');
  assert.deepEqual(on.cellMeta, { name: { '0:a': 'amount' } });
  assert.deepEqual(setCellMeta(on, 'name', 0, 0, undefined).cellMeta, {});
  assert.deepEqual(setRowMeta(s, 'secret', 1, true).rowMeta, { secret: { '1': true } });
  assert.deepEqual(setColMeta(s, 'secret', 1, true).colMeta, { secret: { b: true } });
  assert.deepEqual(s.cellMeta, {}); // 입력 불변
});
