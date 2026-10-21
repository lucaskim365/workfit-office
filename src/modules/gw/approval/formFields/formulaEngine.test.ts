import assert from 'node:assert/strict';
import {
  colIndexToLetter,
  letterToColIndex,
  cellToCoord,
  coordToCell,
  shiftFormulaCoordinates,
  shiftCrossTableRefs,
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

  // 8. 타 표 교차 참조 (Cross-Table Reference: 매출구분 소계 - 매입발주금액 = 매출이익)
  {
    // 타 표 1: 매출구분 표
    const salesTable = {
      cols: ['구분', '비중', '금액'],
      rows: [
        { 구분: 'SW', 비중: '61.3%', 금액: '60,000,000' },
        { 구분: 'H/W', 비중: '38.7%', 금액: '37,826,000' },
        { 구분: '소계', 비중: '100.0%', 금액: '97,826,000' },
      ],
    };

    // 타 표 2: 매입발주 표
    const purchaseTable = {
      cols: ['구분', '발주예상일자', '발주 금액', '비고'],
      rows: [
        { 구분: '인건비', 발주예상일자: '2026-09-01', '발주 금액': '20,000,000', 비고: '' },
        { 구분: 'H/W', 발주예상일자: '2026-09-05', '발주 금액': '40,326,000', 비고: '' },
        { 구분: '매입발주 합계', 발주예상일자: '', '발주 금액': '60,326,000', 비고: '' },
      ],
    };

    // 현재 표: 손익/이익 요약 표
    const profitCols = ['항목', '금액', '비고'];
    const profitRows = [
      { 항목: '매출이익', 금액: '', 비고: '매출 소계 - 매입발주 합계' },
    ];

    const cellFormulas: Record<string, CellFormula> = {
      '0:금액': {
        expression: '=[매출구분]![소계:금액] - [매입발주]![합계:발주 금액]',
        format: 'currency',
      },
    };

    const otherTablesContext = {
      매출구분: salesTable,
      매입발주: purchaseTable,
    };

    const calculated = recalculateTableFormulas(
      profitCols,
      profitRows,
      cellFormulas,
      undefined,
      otherTablesContext
    );

    // 97,826,000 - 60,326,000 = 37,500,000
    assert.equal(calculated[0]['금액'], '37,500,000');
    console.log('✓ 8. 타 표 교차 참조(Cross-Table Reference: 매출구분 소계 - 매입발주 합계 = 매출이익) 통과\n');
  }

  // 9. 복수 표 연쇄 재계산은 sheetModel.test.ts 6번으로 이동

  // 10. 병합 셀 및 행 라벨 참조 (매출구분 소계 - 매입발주 금액의 병합된 셀 = 매출이익)
  {
    const otherTablesContext = {
      매출구분: {
        cols: ['구분', '비중', '금액'],
        rows: [
          { 구분: 'SW', 비중: '60%', 금액: '60,000,000' },
          { 구분: 'HW', 비중: '40%', 금액: '40,000,000' },
          { 구분: '소계', 비중: '100%', 금액: '100,000,000' },
        ],
      },
    };

    const cols = ['매입처', '발주예상일자', '발주 금액', '비고'];
    const rows = [
      { 매입처: '업체A', 발주예상일자: '2026-09-10', '발주 금액': '20,000,000', 비고: '' },
      { 매입처: '업체B', 발주예상일자: '2026-09-15', '발주 금액': '10,000,000', 비고: '' },
      // 5행: '매입발주 금액' 행 (발주예상일자 + 발주 금액이 병합되어 '발주예상일자'에 수식이 걸림)
      { 매입처: '매입발주 금액', 발주예상일자: '', '발주 금액': '', 비고: '' },
      // 6행: '매출이익' 행 (매출구분 소계 - 매입발주 금액)
      { 매입처: '매출이익', 발주예상일자: '', '발주 금액': '', 비고: '' },
    ];

    // 2행(0-indexed)에 매입발주 금액 SUM이 걸려있음
    const cellFormulas: Record<string, CellFormula> = {
      '2:발주예상일자': { expression: '=SUM([발주 금액])', format: 'currency' },
      // 3행에 [매출구분]![소계:금액] - [매입발주 금액:발주 금액] (병합된 다른 컬럼으로 참조해도 동작해야 함!)
      '3:발주예상일자': { expression: '=[매출구분]![소계:금액] - [매입발주 금액:발주 금액]', format: 'currency' },
    };

    // '매입발주 금액' 행의 발주예상일자~발주 금액 두 칸이 병합되어 있음
    const merges = [{ startRow: 2, startCol: 1, rowSpan: 1, colSpan: 2 }];
    const recalculated = recalculateTableFormulas(cols, rows, cellFormulas, undefined, otherTablesContext, merges);

    // 매입발주 금액은 30,000,000
    assert.equal(recalculated[2]['발주예상일자'], '30,000,000');
    // 매출이익은 100,000,000 - 30,000,000 = 70,000,000
    assert.equal(recalculated[3]['발주예상일자'], '70,000,000');

    // [매입발주 금액] 만으로 참조해도 동일하게 동작하는지 테스트
    const cellFormulas2: Record<string, CellFormula> = {
      '2:발주예상일자': { expression: '=SUM([발주 금액])', format: 'currency' },
      '3:발주예상일자': { expression: '=[매출구분]![소계:금액] - [매입발주 금액]', format: 'currency' },
    };
    const recalculated2 = recalculateTableFormulas(cols, rows, cellFormulas2, undefined, otherTablesContext);
    assert.equal(recalculated2[3]['발주예상일자'], '70,000,000');

    console.log('✓ 10. 병합 셀 및 행 라벨 참조 (매출구분 소계 - 매입발주 금액 병합셀 = 매출이익) 통과\n');
  }

  // 11. 여러 열의 위-아래 셀 계산 — 한 열에만 값을 넣어도 다른 열 수식에 값이 번지지 않아야 함
  {
    const cols = ['구분', '1월', '2월'];
    const rows = [
      { 구분: '매출', '1월': '100', '2월': '' },
      { 구분: '매입', '1월': '', '2월': '' },
      { 구분: '차액', '1월': '', '2월': '' },
    ];
    const cellFormulas: Record<string, CellFormula> = {
      '2:1월': { expression: '=[매출:1월] - [매입:1월]', format: 'number' },
      '2:2월': { expression: '=[매출:2월] - [매입:2월]', format: 'number' },
    };
    const recalculated = recalculateTableFormulas(cols, rows, cellFormulas);
    assert.equal(recalculated[2]['1월'], '100');
    assert.equal(recalculated[2]['2월'], '0');

    // 타 표 참조도 빈 칸은 0
    const ctx = { 월별: { cols, rows } };
    const other = recalculateTableFormulas(
      ['항목', '값'],
      [{ 항목: '2월 매출', 값: '' }],
      { '0:값': { expression: '=[월별]![매출:2월]', format: 'number' } },
      undefined,
      ctx
    );
    assert.equal(other[0]['값'], '0');
    console.log('✓ 11. 여러 열 위-아래 셀 계산 — 빈 칸이 다른 열 값으로 대체되지 않음 통과\n');
  }

  // 12~14. 함수·반올림·오류
  {
    const c = ['A', 'B', 'C', 'D'];
    const r = [{ A: '10', B: '4', C: '3', D: '' }];
    const calc = (e: string) =>
      recalculateTableFormulas(c, r, { '0:D': { expression: e, format: 'number' } })[0].D;
    assert.equal(calc('=AVERAGE(A1:C1)'), '5.6666666667');
    assert.equal(calc('=MIN(A1:C1)'), '3');
    assert.equal(calc('=MAX(A1:C1)'), '10');
    assert.equal(calc('=ROUND(A1/C1, 1)'), '3.3');
    assert.equal(calc('=sum(a1:c1)*2'), '34');
    console.log('✓ 12. AVERAGE·MIN·MAX·ROUND·소문자 함수 통과');

    assert.equal(calc('=SUM(A1:C1)*0.1'), '1.7');
    console.log('✓ 13. 소수 오차 반올림 통과');

    // 0으로 나누기는 예전처럼 0 (빈 서식의 비율 칸이 오류로 보이지 않도록)
    assert.equal(calc('=A1/0'), '0');
    assert.equal(calc('=(A1+B1'), '#오류');
    assert.equal(calc('=FOO(A1)'), '#오류');
    assert.equal(calc('=A1+'), '#오류');
    assert.equal(calc('=ROUND((A1+B1)/C1, 2)'), '4.67');
    // 오류 칸을 참조하는 수식도 오류
    const chained = recalculateTableFormulas(c, r, {
      '0:C': { expression: '=FOO(A1)', format: 'number' },
      '0:D': { expression: '=C1+1', format: 'number' },
    });
    assert.equal(chained[0].D, '#오류');
    console.log('✓ 14. invalid formulas show error 통과\n');
  }

  // 15. 같은 표 괄호 숫자 행 참조 이동, 괄호 안 열 제목·타 표 참조는 그대로
  {
    assert.equal(
      shiftFormulaCoordinates('=[2:금액] - [소계:금액] + D3', { type: 'row_add', atIndex: 0 }),
      '=[3:금액] - [소계:금액] + D4'
    );
    assert.equal(shiftFormulaCoordinates('=[매출]!D4 + D4', { type: 'row_add', atIndex: 0 }), '=[매출]!D4 + D5');
    assert.equal(shiftFormulaCoordinates('=[Q1] + A1', { type: 'row_add', atIndex: 0 }), '=[Q1] + A2');
    assert.equal(shiftFormulaCoordinates('=[2:금액]', { type: 'row_del', atIndex: 2 }), '=#REF!');
    console.log('✓ 15. 괄호 숫자 행 참조 이동 통과');
  }

  // 16. 타 표 참조 이동
  {
    assert.equal(
      shiftCrossTableRefs('=[매출]!D4 + [매입]!D4', ['매출'], { type: 'row_add', atIndex: 0 }),
      '=[매출]!D5 + [매입]!D4'
    );
    assert.equal(shiftCrossTableRefs('=[매출]![2:금액]', ['매출'], { type: 'row_del', atIndex: 2 }), '=#REF!');
    assert.equal(
      shiftCrossTableRefs('=[매출]![소계:금액] + [매출]![1:금액] + A1', ['매출'], { type: 'row_add', atIndex: 0 }),
      '=[매출]![소계:금액] + [매출]![2:금액] + A1'
    );
    console.log('✓ 16. 타 표 참조 이동 통과\n');
  }

  console.log('🎉 모든 formulaEngine 테스트 통과!');
}

// 직접 tsx로 실행 시 테스트 자동 수행
if (process.argv[1]?.includes('formulaEngine.test.ts')) {
  runFormulaEngineTests();
}

