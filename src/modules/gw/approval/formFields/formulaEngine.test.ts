import assert from 'node:assert/strict';
import {
  colIndexToLetter,
  letterToColIndex,
  cellToCoord,
  coordToCell,
  shiftFormulaCoordinates,
  recalculateTableFormulas,
  formatCellValue,
  type CellFormula,
} from './formulaEngine';

export function runFormulaEngineTests() {
  console.log('=== formulaEngine 단위 테스트 시작 ===\n');

  // 1. Cell Coordinates
  {
    assert.equal(colIndexToLetter(0), 'A');
    assert.equal(colIndexToLetter(3), 'D');
    assert.equal(colIndexToLetter(25), 'Z');
    assert.equal(colIndexToLetter(26), 'AA');

    assert.equal(letterToColIndex('A'), 0);
    assert.equal(letterToColIndex('D'), 3);
    assert.equal(letterToColIndex('Z'), 25);
    assert.equal(letterToColIndex('AA'), 26);

    assert.equal(cellToCoord(0, 0), 'A1');
    assert.equal(cellToCoord(26, 3), 'D27');
    assert.equal(cellToCoord(36, 3), 'D37');

    assert.deepEqual(coordToCell('A1'), { rIdx: 0, cIdx: 0 });
    assert.deepEqual(coordToCell('D27'), { rIdx: 26, cIdx: 3 });
    assert.deepEqual(coordToCell('$D$27'), { rIdx: 26, cIdx: 3 });
    console.log('✓ 1. 셀 좌표계 변환(colIndex, letter, cellToCoord, coordToCell) 통과');
  }

  // 2. Format Cell Value
  {
    assert.equal(formatCellValue(97826000, 'currency'), '97,826,000');
    assert.equal(formatCellValue(61.332, 'percent1'), '61.3%');
    assert.equal(formatCellValue(38.3323, 'percent2'), '38.33%');
    assert.equal(formatCellValue(1234, 'number'), '1234');
    console.log('✓ 2. 셀 포맷팅(currency, percent1, percent2, number) 통과');
  }

  // 3. Formula Coordinate Re-indexing
  {
    // Row 20 추가 시 (0-based idx 19), 27번 행(1-based)은 28번으로 이동
    const f1 = '=D27 - H27';
    assert.equal(shiftFormulaCoordinates(f1, { type: 'row_add', atIndex: 19 }), '=D28 - H28');

    // Row 15 추가 시 이전 행은 이동 안 함
    const f2 = '=D10 + 5';
    assert.equal(shiftFormulaCoordinates(f2, { type: 'row_add', atIndex: 15 }), '=D10 + 5');

    // D18:D26 범위 내에 20번 행 추가 시 D18:D27 로 자동 확장
    const f3 = '=SUM(D18:D26)';
    assert.equal(shiftFormulaCoordinates(f3, { type: 'row_add', atIndex: 19 }), '=SUM(D18:D27)');

    // 범위 앞쪽에 행 추가 시 전체 시프트
    assert.equal(shiftFormulaCoordinates(f3, { type: 'row_add', atIndex: 5 }), '=SUM(D19:D27)');

    // 삭제된 행은 #REF!
    const f4 = '=D27 - H10';
    assert.equal(shiftFormulaCoordinates(f4, { type: 'row_del', atIndex: 26 }), '=#REF! - H10');
    console.log('✓ 3. 수식 좌표 자동 리인덱싱(단일 셀 시프트, 범위 확장, #REF!) 통과');
  }

  // 4. Contract Report Calculations
  {
    const cols = ['구분', '비중', '매출금액', '매입구분', '매입비중', '매입금액'];
    const rows: Array<Record<string, string>> = [
      { 구분: 'SW', 비중: '', 매출금액: '60,000,000', 매입구분: '인건비', 매입비중: '', 매입금액: '20,000,000' },
      { 구분: 'H/W', 비중: '', 매출금액: '37,826,000', 매입구분: 'H/W', 매입비중: '', 매입금액: '40,326,000' },
      { 구분: '소계', 비중: '', 매출금액: '', 매입구분: '소계', 매입비중: '', 매입금액: '' },
      { 구분: '매출이익', 비중: '', 매출금액: '', 매입구분: '이익률', 매입비중: '', 매입금액: '' },
    ];

    const cellFormulas: Record<string, CellFormula> = {
      '2:매출금액': { expression: '=SUM(C1:C2)', format: 'currency' },
      '2:매입금액': { expression: '=SUM(F1:F2)', format: 'currency' },
      '0:비중': { expression: '=(C1 / C3) * 100', format: 'percent1' },
      '3:매출금액': { expression: '=C3 - F3', format: 'currency' },
      '3:매입비중': { expression: '=(C4 / C3) * 100', format: 'percent2' },
    };

    const calculated = recalculateTableFormulas(cols, rows, cellFormulas);

    assert.equal(calculated[2]['매출금액'], '97,826,000');
    assert.equal(calculated[2]['매입금액'], '60,326,000');
    assert.equal(calculated[3]['매출금액'], '37,500,000');
    assert.equal(calculated[3]['매입비중'], '38.33%');
    assert.equal(calculated[0]['비중'], '61.3%');
    console.log('✓ 4. 계약보고서 복합 연산(소계 SUM, 매출이익 차액, 비중/이익률 백분율) 통과');
  }

  // 5. SUM(ABOVE) for Dynamic Rows
  {
    const cols = ['매입처', '발주금액'];
    const rows: Array<Record<string, string>> = [
      { 매입처: '업체A', 발주금액: '9,226,000' },
      { 매입처: '업체B', 발주금액: '4,550,000' },
      { 매입처: '업체C', 발주금액: '1,100,000' },
      { 매입처: '합계', 발주금액: '' },
    ];

    const cellFormulas: Record<string, CellFormula> = {
      '3:발주금액': { expression: '=SUM(ABOVE)', format: 'currency' },
    };

    const calculated = recalculateTableFormulas(cols, rows, cellFormulas);
    assert.equal(calculated[3]['발주금액'], '14,876,000');
    console.log('✓ 5. 동적 행을 위한 SUM(ABOVE) 상단 전체 자동 합산 통과');
  }

  // 6. SUM([열이름]) 열 이름 기반 자동 합산
  {
    const cols = ['구분', '발주예상일자', '발주 금액', '비고'];
    const rows: Array<Record<string, string>> = [
      { 구분: '', 발주예상일자: '', '발주 금액': '5000', 비고: '' },
      { 구분: '', 발주예상일자: '', '발주 금액': '150', 비고: '' },
      { 구분: '', 발주예상일자: '', '발주 금액': '120', 비고: '' },
      { 구분: '', 발주예상일자: '', '발주 금액': '46', 비고: '' },
      { 구분: '', 발주예상일자: '', '발주 금액': '3', 비고: '' },
      { 구분: '', 발주예상일자: '', '발주 금액': '7,542', 비고: '' },
      { 구분: '매입발주 금액', 발주예상일자: '', '발주 금액': '', 비고: '' },
    ];

    const cellFormulas: Record<string, CellFormula> = {
      '6:발주 금액': { expression: '=SUM([발주 금액])', format: 'currency' },
    };

    const calculated = recalculateTableFormulas(cols, rows, cellFormulas);
    assert.equal(calculated[6]['발주 금액'], '12,861');
    console.log('✓ 6. 열 이름 기반 자동 합산 SUM([발주 금액]) 통과');
  }

  // 7. 총 소계 대비 각 비중(%) 자동 계산
  {
    const cols = ['구분', '비중', '금액'];
    const rows: Array<Record<string, string>> = [
      { 구분: 'SW', 비중: '', 금액: '60,000,000' },
      { 구분: '인건비', 비중: '', 금액: '' },
      { 구분: 'H/W', 비중: '', 금액: '30,576,000' },
      { 구분: 'NW', 비중: '', 금액: '1,420,000' },
      { 구분: '설비 I/F', 비중: '', 금액: '5,380,000' },
      { 구분: '기술임치', 비중: '', 금액: '450,000' },
      { 구분: '소계', 비중: '', 금액: '' },
    ];

    const cellFormulas: Record<string, CellFormula> = {
      '6:금액': { expression: '=SUM(ABOVE)', format: 'currency' },
      '0:비중': { expression: '=( [금액] / [소계:금액] ) * 100', format: 'percent1' },
      '1:비중': { expression: '=( [금액] / [소계:금액] ) * 100', format: 'percent1' },
      '2:비중': { expression: '=( [금액] / [소계:금액] ) * 100', format: 'percent1' },
      '3:비중': { expression: '=( [금액] / [소계:금액] ) * 100', format: 'percent1' },
      '4:비중': { expression: '=( [금액] / [소계:금액] ) * 100', format: 'percent1' },
      '5:비중': { expression: '=( [금액] / [소계:금액] ) * 100', format: 'percent1' },
      '6:비중': { expression: '=SUM(ABOVE)', format: 'percent1' },
    };

    const calculated = recalculateTableFormulas(cols, rows, cellFormulas);
    assert.equal(calculated[6]['금액'], '97,826,000');
    assert.equal(calculated[0]['비중'], '61.3%');
    assert.equal(calculated[1]['비중'], '0.0%');
    assert.equal(calculated[2]['비중'], '31.3%');
    assert.equal(calculated[3]['비중'], '1.5%');
    assert.equal(calculated[4]['비중'], '5.5%');
    assert.equal(calculated[5]['비중'], '0.5%');
    assert.equal(calculated[6]['비중'], '100.1%'); // 61.3 + 0 + 31.3 + 1.5 + 5.5 + 0.5 = 100.1%
    console.log('✓ 7. 총 소계 대비 각 비중(%) 및 [소계:금액] 라벨 참조 자동 계산 통과\n');
  }

  console.log('🎉 모든 formulaEngine 테스트 통과!');
}

// 직접 tsx로 실행 시 테스트 자동 수행
if (process.argv[1]?.includes('formulaEngine.test.ts')) {
  runFormulaEngineTests();
}
