/**
 * 전자결재 위지윅 표(Table) 자동 계산 수식 엔진
 * - 엑셀식 셀 좌표계(A1, B2, D27) 변환 지원
 * - SUM(범위), SUM(ABOVE), 사칙연산(+ - * /) 및 비율 계산
 * - 표시 포맷 지원 (통화/콤마, 백분율 1자리/2자리, 일반 숫자)
 * - 행/열 삽입·삭제 시 수식 좌표 자동 리인덱싱(Re-indexing) 지원
 * - 순환 참조(Circular Reference) 방지 및 안전한 토큰 파서
 */

export type CellFormat = 'currency' | 'percent1' | 'percent2' | 'number';

export interface CellFormula {
  expression: string; // 예: "=SUM(D18:D26)", "=D27 - H27", "=(D18 / D27) * 100", "=SUM(ABOVE)"
  format?: CellFormat;
}

/** 0-based 열 인덱스를 알파벳 열 문자로 변환 (0 -> 'A', 1 -> 'B', ..., 26 -> 'AA') */
export function colIndexToLetter(idx: number): string {
  let temp = idx;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/** 알파벳 열 문자를 0-based 열 인덱스로 변환 ('A' -> 0, 'B' -> 1, ..., 'AA' -> 26) */
export function letterToColIndex(letter: string): number {
  const upper = letter.toUpperCase();
  let idx = 0;
  for (let i = 0; i < upper.length; i++) {
    idx = idx * 26 + (upper.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/** 0-based rIdx, cIdx를 'A1', 'D27' 형태의 좌표 문자열로 변환 (행은 1-based) */
export function cellToCoord(rIdx: number, cIdx: number): string {
  return `${colIndexToLetter(cIdx)}${rIdx + 1}`;
}

/** 'A1', 'D27', '$D$27' 좌표 문자열을 0-based rIdx, cIdx로 파싱 */
export function coordToCell(coord: string): { rIdx: number; cIdx: number } | null {
  const clean = coord.replace(/\$/g, '').trim().toUpperCase();
  const match = clean.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const colLetter = match[1];
  const rowNum = parseInt(match[2], 10);
  if (isNaN(rowNum) || rowNum < 1) return null;
  return {
    cIdx: letterToColIndex(colLetter),
    rIdx: rowNum - 1,
  };
}

/** 셀 문자열에서 숫자 추출 (천단위 콤마, 원화기호 등 제거) */
export function parseCellNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = String(val).replace(/,/g, '').replace(/[₩\s%]/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/** 포맷에 맞추어 숫자를 문자열로 변환 */
export function formatCellValue(num: number, format?: CellFormat): string {
  if (isNaN(num)) return '0';
  switch (format) {
    case 'currency':
      return Math.round(num).toLocaleString('ko-KR');
    case 'percent1':
      return `${num.toFixed(1)}%`;
    case 'percent2':
      return `${num.toFixed(2)}%`;
    case 'number':
      return String(num);
    default:
      // 기본값: 소수점이 없으면 콤마 표기, 있으면 최대 2자리
      return Number.isInteger(num)
        ? num.toLocaleString('ko-KR')
        : num.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }
}

/**
 * 행/열 추가·삭제 시 수식 내부의 좌표 및 범위를 엑셀과 동일하게 자동 리인덱싱(Re-indexing)
 */
export function shiftFormulaCoordinates(
  expression: string,
  action: {
    type: 'row_add' | 'row_del' | 'col_add' | 'col_del';
    atIndex: number; // 0-based 추가/삭제된 위치
  }
): string {
  if (!expression) return expression;

  // 1. 범위 표현식 먼저 변환: 예) D18:D26
  let result = expression.replace(/([A-Z]+)(\d+):([A-Z]+)(\d+)/gi, (_match, c1, r1, c2, r2) => {
    let startCol = letterToColIndex(c1);
    let startRow = parseInt(r1, 10) - 1;
    let endCol = letterToColIndex(c2);
    let endRow = parseInt(r2, 10) - 1;

    // 순서 정규화
    if (startRow > endRow) [startRow, endRow] = [endRow, startRow];
    if (startCol > endCol) [startCol, endCol] = [endCol, startCol];

    if (action.type === 'row_add') {
      if (action.atIndex <= startRow) {
        startRow += 1;
        endRow += 1;
      } else if (action.atIndex <= endRow + 1) {
        // 범위 내부 또는 바로 직후에 추가되면 범위 확장
        endRow += 1;
      }
    } else if (action.type === 'row_del') {
      if (action.atIndex < startRow) {
        startRow -= 1;
        endRow -= 1;
      } else if (action.atIndex <= endRow) {
        endRow -= 1;
        if (endRow < startRow) return '#REF!';
      }
    } else if (action.type === 'col_add') {
      if (action.atIndex <= startCol) {
        startCol += 1;
        endCol += 1;
      } else if (action.atIndex <= endCol + 1) {
        endCol += 1;
      }
    } else if (action.type === 'col_del') {
      if (action.atIndex < startCol) {
        startCol -= 1;
        endCol -= 1;
      } else if (action.atIndex <= endCol) {
        endCol -= 1;
        if (endCol < startCol) return '#REF!';
      }
    }

    return `${colIndexToLetter(startCol)}${startRow + 1}:${colIndexToLetter(endCol)}${endRow + 1}`;
  });

  // 2. 단일 셀 좌표 변환 (범위가 아닌 독립 셀): 예) D27
  result = result.replace(/(?<!:|\w)([A-Z]+)(\d+)(?!:)/gi, (_match, colStr, rowStr) => {
    let cIdx = letterToColIndex(colStr);
    let rIdx = parseInt(rowStr, 10) - 1;

    if (action.type === 'row_add') {
      if (rIdx >= action.atIndex) rIdx += 1;
    } else if (action.type === 'row_del') {
      if (rIdx === action.atIndex) return '#REF!';
      if (rIdx > action.atIndex) rIdx -= 1;
    } else if (action.type === 'col_add') {
      if (cIdx >= action.atIndex) cIdx += 1;
    } else if (action.type === 'col_del') {
      if (cIdx === action.atIndex) return '#REF!';
      if (cIdx > action.atIndex) cIdx -= 1;
    }

    return `${colIndexToLetter(cIdx)}${rIdx + 1}`;
  });

  return result;
}

/** 안전한 사칙연산 수식 평가기 (토큰 기반, eval 배제) */
function evaluateArithmetic(expr: string): number {
  const tokens: string[] = [];
  const cleanExpr = expr.replace(/\s+/g, '');
  let i = 0;

  while (i < cleanExpr.length) {
    const ch = cleanExpr[i];
    if ('+-*/()'.includes(ch)) {
      // 음수 처리: 식 맨 앞이거나 여는 괄호/연산자 바로 뒤의 마이너스
      if (ch === '-' && (tokens.length === 0 || '+-*/('.includes(tokens[tokens.length - 1]))) {
        let numStr = '-';
        i++;
        while (i < cleanExpr.length && /[\d.]/.test(cleanExpr[i])) {
          numStr += cleanExpr[i];
          i++;
        }
        tokens.push(numStr);
        continue;
      }
      tokens.push(ch);
      i++;
    } else if (/[\d.]/.test(ch)) {
      let numStr = '';
      while (i < cleanExpr.length && /[\d.]/.test(cleanExpr[i])) {
        numStr += cleanExpr[i];
        i++;
      }
      tokens.push(numStr);
    } else {
      i++;
    }
  }

  // Shunting-yard 알고리즘을 이용한 RPN 변환 및 계산
  const outputQueue: (number | string)[] = [];
  const operatorStack: string[] = [];
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

  for (const token of tokens) {
    const num = parseFloat(token);
    if (!isNaN(num) && !'+-*/()'.includes(token)) {
      outputQueue.push(num);
    } else if ('+-*/'.includes(token)) {
      while (
        operatorStack.length > 0 &&
        operatorStack[operatorStack.length - 1] !== '(' &&
        precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]
      ) {
        outputQueue.push(operatorStack.pop()!);
      }
      operatorStack.push(token);
    } else if (token === '(') {
      operatorStack.push(token);
    } else if (token === ')') {
      while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
        outputQueue.push(operatorStack.pop()!);
      }
      operatorStack.pop(); // '(' 제거
    }
  }

  while (operatorStack.length > 0) {
    outputQueue.push(operatorStack.pop()!);
  }

  // RPN 계산
  const evalStack: number[] = [];
  for (const item of outputQueue) {
    if (typeof item === 'number') {
      evalStack.push(item);
    } else {
      const b = evalStack.pop() ?? 0;
      const a = evalStack.pop() ?? 0;
      let res = 0;
      if (item === '+') res = a + b;
      else if (item === '-') res = a - b;
      else if (item === '*') res = a * b;
      else if (item === '/') res = b === 0 ? 0 : a / b;
      evalStack.push(res);
    }
  }

  return evalStack.pop() ?? 0;
}

/**
 * 테이블 전체 수식 일괄 실시간 재계산
 * - cols: 열 이름 배열 (예: ['구분', '비중', '금액', ...])
 * - rows: 행 데이터 배열
 * - cellFormulas: 키 "rIdx:colName" -> 수식 객체
 * - 반환값: 수식 계산 결과가 반영된 새로운 rows 배열
 */
export function recalculateTableFormulas(
  cols: string[],
  rows: Array<Record<string, string>>,
  cellFormulas?: Record<string, CellFormula>,
  headerValues?: Record<string, string>
): Array<Record<string, string>> {
  if (!cellFormulas || Object.keys(cellFormulas).length === 0 || rows.length === 0) {
    return rows;
  }

  const nextRows = rows.map((r) => ({ ...r }));
  const formulaKeys = Object.keys(cellFormulas);

  // 열 이름 또는 헤더 타이틀로 실제 키 찾기
  const resolveColKey = (title: string): string => {
    const trimmed = title.trim();
    if (cols.includes(trimmed)) return trimmed;
    if (headerValues) {
      const match = Object.keys(headerValues).find((k) => headerValues[k] === trimmed);
      if (match && cols.includes(match)) return match;
    }
    return trimmed;
  };

  // 셀 값 가져오기 헬퍼 (rIdx, cIdx)
  const getCellValue = (rIdx: number, cIdx: number): number => {
    if (rIdx < 0 || rIdx >= nextRows.length) return 0;
    if (cIdx < 0 || cIdx >= cols.length) return 0;
    const colName = cols[cIdx];
    return parseCellNumber(nextRows[rIdx][colName]);
  };

  // 단일 수식 평가 함수 (순환 참조 방지용 stack 포함)
  const evaluateCellFormula = (key: string, stack: Set<string> = new Set()): number => {
    if (stack.has(key)) {
      // 순환 참조 감지
      return 0;
    }
    stack.add(key);

    const fInfo = cellFormulas[key];
    if (!fInfo || !fInfo.expression) return 0;

    const [rIdxStr, colName] = key.split(':');
    const targetRowIdx = parseInt(rIdxStr, 10);
    const targetColIdx = cols.indexOf(colName);
    if (targetColIdx === -1) return 0;

    let expr = fInfo.expression.trim();
    if (expr.startsWith('=')) expr = expr.slice(1).trim();

    // 0. SUM([열이름]) 처리: 지정된 열의 상단 모든 행 합산
    expr = expr.replace(/SUM\s*\(\s*\[([^\]]+)\]\s*\)/gi, (_m, rawColTitle) => {
      const actualCol = resolveColKey(rawColTitle);
      const cIdx = cols.indexOf(actualCol);
      let sum = 0;
      for (let r = 0; r < targetRowIdx; r++) {
        if (cIdx !== -1) {
          sum += getCellValue(r, cIdx);
        } else {
          sum += parseCellNumber(nextRows[r][actualCol]);
        }
      }
      return String(sum);
    });

    // 1. SUM(ABOVE) 처리: 현재 셀 위의 모든 행 합산
    expr = expr.replace(/SUM\s*\(\s*ABOVE\s*\)/gi, () => {
      let sum = 0;
      for (let r = 0; r < targetRowIdx; r++) {
        sum += getCellValue(r, targetColIdx);
      }
      return String(sum);
    });

    // 2. SUM(범위) 처리: 예) SUM(D18:D26)
    expr = expr.replace(/SUM\s*\(\s*([A-Z]+)(\d+)\s*:\s*([A-Z]+)(\d+)\s*\)/gi, (_m, c1, r1, c2, r2) => {
      let startCol = letterToColIndex(c1);
      let startRow = parseInt(r1, 10) - 1;
      let endCol = letterToColIndex(c2);
      let endRow = parseInt(r2, 10) - 1;

      if (startRow > endRow) [startRow, endRow] = [endRow, startRow];
      if (startCol > endCol) [startCol, endCol] = [endCol, startCol];

      let sum = 0;
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const depColName = cols[c];
          const depKey = `${r}:${depColName}`;
          if (cellFormulas[depKey] && !stack.has(depKey)) {
            // 종속 수식 셀이 있으면 먼저 평가
            sum += evaluateCellFormula(depKey, new Set(stack));
          } else {
            sum += getCellValue(r, c);
          }
        }
      }
      return String(sum);
    });

    // 3. [열이름] 또는 [행:열이름] 명시적 참조 치환
    expr = expr.replace(/\[([^\]]+)\]/g, (_m, token) => {
      const cleanToken = token.trim();
      if (cleanToken.includes(':')) {
        const [rStr, cName] = cleanToken.split(':');
        const trimmedRStr = rStr.trim();
        let r = -1;
        if (/^\d+$/.test(trimmedRStr)) {
          r = parseInt(trimmedRStr, 10);
        } else if (trimmedRStr.toUpperCase() === 'LAST') {
          r = nextRows.length - 1;
        } else {
          // 행 라벨 검색 (예: '소계', '합계')
          const targetLabel = trimmedRStr.toLowerCase();
          r = nextRows.findIndex((row) =>
            Object.values(row).some(
              (val) => typeof val === 'string' && val.trim().toLowerCase() === targetLabel
            )
          );
          if (r === -1) {
            r = nextRows.findIndex((row) =>
              Object.values(row).some(
                (val) => typeof val === 'string' && val.trim().toLowerCase().includes(targetLabel)
              )
            );
          }
        }
        const actualCol = resolveColKey(cName);
        if (r >= 0 && r < nextRows.length) {
          const depKey = `${r}:${actualCol}`;
          if (cellFormulas[depKey] && !stack.has(depKey)) {
            return String(evaluateCellFormula(depKey, new Set(stack)));
          }
          return String(parseCellNumber(nextRows[r][actualCol]));
        }
        return '0';
      }
      const actualCol = resolveColKey(cleanToken);
      const depKey = `${targetRowIdx}:${actualCol}`;
      if (cellFormulas[depKey] && !stack.has(depKey)) {
        return String(evaluateCellFormula(depKey, new Set(stack)));
      }
      return String(parseCellNumber(nextRows[targetRowIdx][actualCol]));
    });

    // 4. 단일 셀 참조 치환: 예) D27, H27
    expr = expr.replace(/([A-Z]+)(\d+)/gi, (_m, colStr, rowStr) => {
      const c = letterToColIndex(colStr);
      const r = parseInt(rowStr, 10) - 1;
      if (r < 0 || r >= nextRows.length || c < 0 || c >= cols.length) return '0';

      const depColName = cols[c];
      const depKey = `${r}:${depColName}`;
      if (cellFormulas[depKey] && !stack.has(depKey)) {
        return String(evaluateCellFormula(depKey, new Set(stack)));
      }
      return String(getCellValue(r, c));
    });

    // 5. 사칙연산 평가
    return evaluateArithmetic(expr);
  };

  // 모든 수식 셀을 차례대로 평가하여 적용
  formulaKeys.forEach((key) => {
    const [rIdxStr, colName] = key.split(':');
    const rIdx = parseInt(rIdxStr, 10);
    if (rIdx >= 0 && rIdx < nextRows.length && cols.includes(colName)) {
      const calculatedVal = evaluateCellFormula(key);
      const fInfo = cellFormulas[key];
      nextRows[rIdx][colName] = formatCellValue(calculatedVal, fInfo?.format);
    }
  });

  return nextRows;
}
