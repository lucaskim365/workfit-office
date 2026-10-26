import assert from 'node:assert/strict';
import type { SheetPayload } from './sheetModel';
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
  setSecretCell,
  propagateStructureChange,
} from './sheetOps';

function sheet(rowCount: number, cols = ['A', 'B', 'C'], extra: Partial<SheetPayload> = {}): SheetPayload {
  return {
    version: 2,
    cols,
    rows: Array.from({ length: rowCount }, (_, r) => Object.fromEntries(cols.map((c) => [c, `${c}${r}`]))),
    colWidths: {},
    tableWidth: '100%',
    merges: [],
    cellFormulas: {},
    cellStyles: {},
    secretCols: [],
    secretCells: [],
    secretRows: [],
    ...extra,
  };
}

export function runSheetOpsTests() {
  console.log('=== sheetOps 단위 테스트 시작 ===\n');

  // 1. insertRow shifts formulas and styles
  {
    const p = sheet(3, ['A', 'B', 'C'], {
      cellFormulas: { '2:A': { expression: '=A1+A2', format: 'number' } },
      cellStyles: { '0:A': { bold: true }, '2:B': { bg: 'red' } },
    });
    const n = insertRow(p, 1);
    assert.equal(n.rows.length, 4);
    assert.deepEqual(n.rows[1], { A: '', B: '', C: '' });
    assert.deepEqual(n.cellFormulas, { '3:A': { expression: '=A1+A3', format: 'number' } });
    assert.deepEqual(n.cellStyles, { '0:A': { bold: true }, '3:B': { bg: 'red' } });
    assert.equal(p.rows.length, 3, '입력 불변');
    console.log('✓ 1. insertRow shifts formulas and styles 통과');
  }

  // 2. insertRow shifts secret cells
  {
    const p = sheet(3, ['A', 'B'], { secretCells: ['1:B'], secretRows: [2] });
    const n = insertRow(p, 0);
    assert.deepEqual(n.secretCells, ['2:B']);
    assert.deepEqual(n.secretRows, [3]);
    const d = deleteRow(n, 2);
    assert.deepEqual(d.secretCells, []);
    assert.deepEqual(d.secretRows, [2]);
    console.log('✓ 2. insertRow shifts secret cells 통과');
  }

  // 3. deleteCol shrinks merge, formulas follow
  {
    const p = sheet(2, ['A', 'B', 'C', 'D'], {
      merges: [{ startRow: 0, startCol: 0, rowSpan: 1, colSpan: 3 }],
      cellFormulas: { '1:D': { expression: '=C1+B1', format: 'number' } },
      colWidths: { B: '90px' },
    });
    const n = deleteCol(p, 1);
    assert.deepEqual(n.cols, ['A', 'C', 'D']);
    assert.deepEqual(n.merges, [{ startRow: 0, startCol: 0, rowSpan: 1, colSpan: 2 }]);
    assert.deepEqual(n.cellFormulas, { '1:D': { expression: '=B1+#REF!', format: 'number' } });
    assert.equal(n.colWidths.B, undefined);
    assert.equal('B' in n.rows[0], false);
    // 병합이 한 칸만 남으면 병합 해제
    const one = deleteCol(deleteCol(p, 1), 1);
    assert.deepEqual(one.merges, []);
    console.log('✓ 3. deleteCol shrinks merge 통과');
  }

  // 4. insertCol makes a unique hidden key
  {
    const p = sheet(2, ['A', 'B']);
    const n = insertCol(p, 1);
    assert.equal(n.cols.length, 3);
    const key = n.cols[1];
    assert.match(key, /^c_[a-z0-9]{6}$/);
    assert.equal(n.rows[0][key], '');
    console.log('✓ 4. insertCol makes a unique hidden key 통과');
  }

  // 5. mergeRange keeps anchor value only, absorbs inner merges; unmerge
  {
    const p = sheet(3, ['A', 'B', 'C'], { merges: [{ startRow: 1, startCol: 1, rowSpan: 1, colSpan: 2 }] });
    const n = mergeRange(p, { r1: 0, c1: 0, r2: 1, c2: 2 });
    assert.deepEqual(n.merges, [{ startRow: 0, startCol: 0, rowSpan: 2, colSpan: 3 }]);
    assert.equal(n.rows[0].A, 'A0');
    assert.equal(n.rows[0].B, '');
    assert.equal(n.rows[1].C, '');
    assert.equal(n.rows[2].A, 'A2');
    assert.deepEqual(unmergeAt(n, 1, 1).merges, []);
    console.log('✓ 5. mergeRange keeps anchor value only 통과');
  }

  // 6. applyStyle / applyBorder
  {
    const p = sheet(2, ['A', 'B']);
    const s = applyStyle(p, { r1: 0, c1: 0, r2: 1, c2: 0 }, { bold: true, align: 'right' });
    assert.deepEqual(s.cellStyles['0:A'], { bold: true, align: 'right' });
    assert.deepEqual(s.cellStyles['1:A'], { bold: true, align: 'right' });
    assert.equal(s.cellStyles['0:B'], undefined);

    const all = { r1: 0, c1: 0, r2: 1, c2: 1 };
    const outer = applyBorder(p, all, 'outer');
    assert.deepEqual(outer.cellStyles['0:A'].border, { t: 'thin', l: 'thin' });
    assert.deepEqual(outer.cellStyles['1:B'].border, { b: 'thin', r: 'thin' });
    const thick = applyBorder(p, all, 'thickOuter');
    assert.deepEqual(thick.cellStyles['0:B'].border, { t: 'thick', r: 'thick' });
    const every = applyBorder(p, all, 'all');
    assert.deepEqual(every.cellStyles['1:A'].border, { t: 'thin', r: 'thin', b: 'thin', l: 'thin' });
    const none = applyBorder(every, all, 'none');
    assert.deepEqual(none.cellStyles['0:A'].border, { t: 'none', r: 'none', b: 'none', l: 'none' });
    console.log('✓ 6. applyStyle / applyBorder 통과');
  }

  // 7. pasteTsv grows sheet
  {
    const p = sheet(2, ['A', 'B']);
    const n = pasteTsv(p, 1, 1, 'a\tb\r\nc\td\r\n');
    assert.equal(n.rows.length, 3);
    assert.equal(n.cols.length, 3);
    assert.equal(n.rows[1].B, 'a');
    assert.equal(n.rows[1][n.cols[2]], 'b');
    assert.equal(n.rows[2][n.cols[2]], 'd');
    assert.equal(n.rows[0].A, 'A0');
    // 붙여넣은 칸의 기존 수식은 사라짐
    const f = pasteTsv(sheet(1, ['A'], { cellFormulas: { '0:A': { expression: '=1', format: 'number' } } }), 0, 0, 'x');
    assert.deepEqual(f.cellFormulas, {});
    console.log('✓ 7. pasteTsv grows sheet 통과');
  }

  // 8. setCellValue formula vs text
  {
    const p = sheet(1, ['A', 'B']);
    const f = setCellValue(p, 0, 1, '=A1*2');
    assert.deepEqual(f.cellFormulas['0:B'], { expression: '=A1*2', format: 'number' });
    const t = setCellValue(f, 0, 1, 'abc');
    assert.equal(t.cellFormulas['0:B'], undefined);
    assert.equal(t.rows[0].B, 'abc');
    // 기존 수식의 표시 형식은 유지
    const keep = setCellValue(sheet(1, ['A'], { cellFormulas: { '0:A': { expression: '=1', format: 'currency' } } }), 0, 0, '=2');
    assert.equal(keep.cellFormulas['0:A'].format, 'currency');
    console.log('✓ 8. setCellValue formula vs text 통과');
  }

  // 9. setSecretCell
  {
    const p = sheet(1, ['A', 'B']);
    const on = setSecretCell(p, 0, 1, true);
    assert.deepEqual(on.secretCells, ['0:B']);
    assert.deepEqual(setSecretCell(on, 0, 1, false).secretCells, []);
    console.log('✓ 9. setSecretCell 통과');
  }

  // 10. propagateStructureChange
  {
    const x = sheet(5, ['A', 'B', 'C', 'D']);
    const y = sheet(1, ['A'], {
      cellFormulas: { '0:A': { expression: '=[X]!D4 + [표X]![2:금액] + [Z]!D4', format: 'number' } },
    });
    const out = propagateStructureChange({ tx: x, ty: y }, { tx: 'X', ty: 'Y' }, 'tx', { type: 'row_add', atIndex: 0 });
    assert.equal(out.ty.cellFormulas['0:A'].expression, '=[X]!D5 + [표X]![2:금액] + [Z]!D4');
    const byKey = propagateStructureChange(
      { tx: x, ty: sheet(1, ['A'], { cellFormulas: { '0:A': { expression: '=[tx]!A1', format: 'number' } } }) },
      { tx: 'X', ty: 'Y' },
      'tx',
      { type: 'row_add', atIndex: 0 }
    );
    assert.equal(byKey.ty.cellFormulas['0:A'].expression, '=[tx]!A2');
    assert.equal(out.tx, x, '바뀐 표 자신은 그대로');
    console.log('✓ 10. propagateStructureChange 통과\n');
  }

  console.log('🎉 모든 sheetOps 테스트 통과!');
}

if (process.argv[1]?.includes('sheetOps.test.ts')) {
  runSheetOpsTests();
}
