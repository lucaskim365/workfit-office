import assert from 'node:assert/strict';
import { recalculateTableFormulas, type CellFormula } from './formulaEngine';
import { normalizeTablePayload, serializeSheet, sheetSignature, recalculateSheet, type SheetPayload } from './sheetModel';

/** 예전 TableFieldEditor 합계 칸 규칙(열 키에 '금액' + amountCells 합) */
function legacySum(
  cols: string[],
  rows: Array<Record<string, string>>,
  sumCell: { rIdx: number; col: string },
  amountCells: Array<{ rIdx: number; col: string }> = []
) {
  let sum = 0;
  rows.forEach((r, idx) => {
    cols.forEach((c) => {
      if (sumCell.rIdx === idx && sumCell.col === c) return;
      if (c.includes('금액') || amountCells.some((ac) => ac.rIdx === idx && ac.col === c)) {
        sum += Number(String(r[c] ?? '').replace(/[^0-9]/g, '')) || 0;
      }
    });
  });
  const next = rows.map((r) => ({ ...r }));
  next[sumCell.rIdx] = { ...next[sumCell.rIdx], [sumCell.col]: sum > 0 ? String(sum) : '' };
  return next;
}

export function runSheetModelTests() {
  console.log('=== sheetModel 단위 테스트 시작 ===\n');

  // 1. legacy contract table keeps values
  {
    const cols = ['구분', '비중', '매출금액', '매입구분', '매입비중', '매입금액'];
    const headerValues = { 구분: '구분', 비중: '비중', 매출금액: '2026 매출 금액', 매입구분: '구분', 매입비중: '비중', 매입금액: '매입 금액' };
    const rows: Array<Record<string, string>> = [
      { 구분: 'SW', 비중: '', 매출금액: '60,000,000', 매입구분: '인건비', 매입비중: '', 매입금액: '20,000,000' },
      { 구분: 'H/W', 비중: '', 매출금액: '37,826,000', 매입구분: 'H/W', 매입비중: '', 매입금액: '40,326,000' },
      { 구분: '소계', 비중: '', 매출금액: '', 매입구분: '소계', 매입비중: '', 매입금액: '' },
      { 구분: '매출이익', 비중: '', 매출금액: '', 매입구분: '이익률', 매입비중: '', 매입금액: '' },
    ];
    const cellFormulas: Record<string, CellFormula> = {
      '2:매출금액': { expression: '=SUM(C1:C2)', format: 'currency' },
      '2:매입금액': { expression: '=SUM([매입 금액])', format: 'currency' },
      '0:비중': { expression: '=(C1 / [소계:매출금액]) * 100', format: 'percent1' },
      '3:매출금액': { expression: '=[2:매출금액] - F3', format: 'currency' },
      '3:매입비중': { expression: '=(C4 / C3) * 100', format: 'percent2' },
    };
    const merges = [{ startRow: -1, startCol: 0, rowSpan: 1, colSpan: 2 }];
    const sumCell = { rIdx: 3, col: '매입금액' };
    const legacy = { cols, rows, defaultRows: rows, headerValues, cellFormulas, merges, sumCell, amountCells: [], secretCells: ['1:2'], secretRows: [3], secretCols: ['매입비중'], colWidths: { 구분: '80px' }, tableWidth: '100%' };

    const expected = legacySum(cols, recalculateTableFormulas(cols, rows, cellFormulas, headerValues), sumCell);
    const sheet = recalculateSheet(normalizeTablePayload(JSON.stringify(legacy)));

    assert.equal(sheet.version, 2);
    assert.equal(sheet.legacyHeaderRow, true);
    assert.deepEqual(sheet.rows[0], headerValues);
    assert.deepEqual(sheet.cellStyles['0:구분'], { bold: true, bg: 'gray', align: 'center' });
    expected.forEach((row, i) => assert.deepEqual(sheet.rows[i + 1], row, `row ${i}`));
    assert.deepEqual(sheet.merges, [{ startRow: 0, startCol: 0, rowSpan: 1, colSpan: 2 }]);
    assert.deepEqual(sheet.secretCells, ['2:매출금액']);
    assert.deepEqual(sheet.secretRows, [4]);
    assert.deepEqual(sheet.secretCols, ['매입비중']);
    assert.deepEqual(sheet.sumCell, { rIdx: 4, col: '매입금액' });
    console.log('✓ 1. legacy contract table keeps values 통과');
  }

  // 2. legacy cross-table A1 ref stays equal (머리글 '합계 금액'이 소계/합계 검색에 걸리지 않음)
  {
    const xCols = ['구분', '금액'];
    const xRows = [
      { 구분: 'a', 금액: '10' },
      { 구분: 'b', 금액: '20' },
      { 구분: '소계', 금액: '' },
    ];
    const xFormulas: Record<string, CellFormula> = { '2:금액': { expression: '=SUM(B1:B2)', format: 'number' } };
    const xHeaders = { 구분: '구분', 금액: '합계 금액' };
    const yCols = ['항목', '값'];
    const yRows = [{ 항목: 'x2', 값: '' }];
    const yFormulas: Record<string, CellFormula> = {
      '0:값': { expression: '=[X]!B3*2 + [X]![소계:금액] + [X]![1:금액] + [X]![금액]', format: 'number' },
    };

    const oldX = recalculateTableFormulas(xCols, xRows, xFormulas, xHeaders);
    const oldY = recalculateTableFormulas(yCols, yRows, yFormulas, undefined, { X: { cols: xCols, rows: oldX, headerValues: xHeaders } });
    assert.equal(oldY[0]['값'], '140');

    const nx = recalculateSheet(normalizeTablePayload({ cols: xCols, rows: xRows, cellFormulas: xFormulas, headerValues: xHeaders }));
    const ny = recalculateSheet(normalizeTablePayload({ cols: yCols, rows: yRows, cellFormulas: yFormulas }), { X: nx });
    assert.equal(ny.rows[1]['값'], '140');
    console.log('✓ 2. legacy cross-table A1 ref stays equal 통과');
  }

  // 3. legacy numeric header does not join sums
  {
    const legacy = {
      cols: ['연도', '값'],
      headerValues: { 연도: '연도', 값: '2026' },
      rows: [{ 연도: 'a', 값: '5' }, { 연도: '합', 값: '' }],
      cellFormulas: { '1:값': { expression: '=SUM(ABOVE)', format: 'number' } },
    };
    const sheet = recalculateSheet(normalizeTablePayload(legacy));
    assert.equal(sheet.rows[2]['값'], '5');
    console.log('✓ 3. legacy numeric header does not join sums 통과');
  }

  // 4. v2 roundtrip
  {
    const p: SheetPayload = {
      version: 2,
      cols: ['c_aaaaaa', 'c_bbbbbb'],
      rows: [{ c_aaaaaa: '항목', c_bbbbbb: '1' }],
      colWidths: {},
      tableWidth: '100%',
      merges: [],
      cellFormulas: { '0:c_bbbbbb': { expression: '=1+1', format: 'number' } },
      cellStyles: { '0:c_aaaaaa': { bold: true, border: { t: 'thick' } } },
      secretCols: [],
      secretCells: ['0:c_aaaaaa'],
      secretRows: [],
      baseSig: 'abc',
    };
    const back = normalizeTablePayload(JSON.parse(serializeSheet(p)));
    assert.deepEqual(back, p);
    const raw = JSON.parse(serializeSheet(p));
    assert.deepEqual(raw.defaultRows, p.rows);
    console.log('✓ 4. v2 roundtrip 통과');
  }

  // 5. signature ignores values
  {
    const base = normalizeTablePayload({ cols: ['a', 'b'], rows: [{ a: '1', b: '2' }] });
    const valueChanged = { ...base, rows: base.rows.map(() => ({ a: '9', b: '9' })) };
    const styleChanged = { ...base, cellStyles: { '0:a': { bold: true } } };
    assert.equal(sheetSignature(base), sheetSignature(valueChanged));
    assert.notEqual(sheetSignature(base), sheetSignature(styleChanged));
    console.log('✓ 5. signature ignores values 통과\n');
  }

  console.log('🎉 모든 sheetModel 테스트 통과!');
}

if (process.argv[1]?.includes('sheetModel.test.ts')) {
  runSheetModelTests();
}
