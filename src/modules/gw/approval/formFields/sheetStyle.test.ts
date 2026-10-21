import assert from 'node:assert/strict';
import { normalizeTablePayload } from './sheetModel';
import { displayCellValue, defaultAlign, isSecretCell, cellCss } from './sheetStyle';
import { resolveViewSheet } from './SheetView';

export function runSheetStyleTests() {
  console.log('=== sheetStyle 단위 테스트 시작 ===\n');

  const legacy = {
    cols: ['구분', '금액'],
    headerValues: { 구분: '구분', 금액: '금액' },
    rows: [{ 구분: 'a', 금액: '1234567' }, { 구분: '', 금액: '' }],
    secretCols: ['금액'],
    secretCells: ['1:0'],
  };

  // 1. 예전 표 표시 규칙 유지 — 숫자 열 콤마·빈 칸 '—'·제목 행은 그대로
  {
    const s = normalizeTablePayload(legacy);
    assert.equal(displayCellValue(s, 1, '금액'), '1,234,567');
    assert.equal(displayCellValue(s, 2, '구분'), '—');
    assert.equal(displayCellValue(s, 0, '금액'), '금액');
    assert.equal(defaultAlign(s, 1, '금액'), 'right');
    assert.equal(defaultAlign(s, 1, '구분'), 'left');
    console.log('✓ 1. 예전 표 표시 규칙 통과');
  }

  // 2. 예전 제목 행은 비공개 가림 대상이 아님, 변환된 비공개 칸은 그대로
  {
    const s = normalizeTablePayload(legacy);
    assert.equal(isSecretCell(s, 0, '금액'), false);
    assert.equal(isSecretCell(s, 1, '금액'), true);
    assert.equal(isSecretCell(s, 2, '구분'), true);
    assert.equal(isSecretCell(s, 1, '구분'), false);
    console.log('✓ 2. 비공개 칸 판정 통과');
  }

  // 3. 새 표 숫자 표시·정렬·서식
  {
    const s = normalizeTablePayload({
      version: 2,
      cols: ['x'],
      rows: [{ x: '1500' }, { x: '12' }, { x: '' }],
      cellStyles: { '0:x': { numFmt: 'currency' }, '1:x': { numFmt: 'percent', bold: true, bg: 'red' } },
    });
    assert.equal(displayCellValue(s, 0, 'x'), '1,500');
    assert.equal(displayCellValue(s, 1, 'x'), '12%');
    assert.equal(displayCellValue(s, 2, 'x'), '');
    assert.equal(defaultAlign(s, 0, 'x'), 'right');
    assert.deepEqual(cellCss(s.cellStyles['1:x']), { fontWeight: 700, backgroundColor: '#fde8e8', color: '#1a1a1a' });
    assert.deepEqual(cellCss({ border: { t: 'thick', b: 'none' } }), { borderTop: '2px solid #111', borderBottom: '1px hidden transparent' });
    console.log('✓ 3. 새 표 표시 서식 통과');
  }

  // 4. resolveViewSheet — 문서 값 우선, 서식의 비공개 열 추가, 문서 값 없으면 서식
  {
    const master = JSON.stringify({ version: 2, cols: ['a', 'b'], rows: [{ a: '', b: '' }], secretCols: ['b'] });
    const doc = JSON.stringify({ version: 2, cols: ['a', 'b'], rows: [{ a: '1', b: '2' }, { a: '3', b: '4' }], secretCells: ['1:a'] });
    const v = resolveViewSheet(master, doc);
    assert.equal(v.rows.length, 2);
    assert.deepEqual(v.secretCols, ['b']);
    assert.deepEqual(v.secretCells, ['1:a']);
    assert.equal(resolveViewSheet(master, '').rows.length, 1);
    console.log('✓ 4. resolveViewSheet 통과\n');
  }

  console.log('🎉 모든 sheetStyle 테스트 통과!');
}

if (process.argv[1]?.includes('sheetStyle.test.ts')) {
  runSheetStyleTests();
}
