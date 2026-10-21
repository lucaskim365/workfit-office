/**
 * 전자결재 위지윅 표(Table) 자동 계산 수식 엔진
 * - 엑셀식 셀 좌표계(A1, B2, D27) 변환 지원
 * - SUM(범위), SUM(ABOVE), 사칙연산(+ - * /) 및 비율 계산
 * - 표시 포맷 지원 (통화/콤마, 백분율 1자리/2자리, 일반 숫자)
 * - 행/열 삽입·삭제 시 수식 좌표 자동 리인덱싱(Re-indexing) 지원
 * - 순환 참조(Circular Reference) 방지 및 안전한 토큰 파서
 */

import type { CellMerge } from './utils';

export type CellFormat = 'currency' | 'percent1' | 'percent2' | 'number';

/** 병합 블록 안의 칸이면 병합 대표(왼쪽 위) 칸 좌표로 바꿔 줌 — 병합이 아니면 그대로 */
function toMergeAnchor(rIdx: number, cIdx: number, merges?: CellMerge[]): { rIdx: number; cIdx: number } {
  const m = (merges || []).find(
    (mg) =>
      rIdx >= mg.startRow &&
      rIdx < mg.startRow + mg.rowSpan &&
      cIdx >= mg.startCol &&
      cIdx < mg.startCol + mg.colSpan
  );
  return m ? { rIdx: m.startRow, cIdx: m.startCol } : { rIdx, cIdx };
}

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

export type ShiftAction = {
  type: 'row_add' | 'row_del' | 'col_add' | 'col_del';
  atIndex: number; // 0-based 추가/삭제된 위치
};

/** 괄호 없는 수식 조각의 A1 좌표·범위 이동 */
function shiftPlainCoordinates(expression: string, action: ShiftAction): string {
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

/** 괄호 참조 안쪽 "2:금액" 형태의 숫자 행 이동 — 지워진 행이면 null, 라벨·LAST는 그대로 */
function shiftBracketRow(inside: string, action: ShiftAction): string | null {
  const m = inside.match(/^(\s*)(\d+)(\s*:.*)$/s);
  if (!m || (action.type !== 'row_add' && action.type !== 'row_del')) return inside;
  let r = parseInt(m[2], 10);
  if (action.type === 'row_add') {
    if (r >= action.atIndex) r += 1;
  } else {
    if (r === action.atIndex) return null;
    if (r > action.atIndex) r -= 1;
  }
  return `${m[1]}${r}${m[3]}`;
}

// 타 표 참조 [표]![..] / [표]!D4, 같은 표 괄호 참조 [..]
const BRACKET_SEGMENT = /\[([^\]!]+)\]\s*!\s*(?:\[([^\]]*)\]|([A-Z]+\d+))|\[([^\]]*)\]/gi;

/**
 * 행/열 추가·삭제 시 수식 내부의 좌표 및 범위를 엑셀과 동일하게 자동 리인덱싱(Re-indexing)
 * - 같은 표의 A1 좌표·범위와 [2:금액] 숫자 행 참조를 이동
 * - 괄호 안 열 제목과 타 표 참조는 건드리지 않음 (타 표는 shiftCrossTableRefs)
 */
export function shiftFormulaCoordinates(expression: string, action: ShiftAction): string {
  if (!expression) return expression;
  const kept: string[] = [];
  const masked = expression.replace(BRACKET_SEGMENT, (seg, _t, _ti, _tc, inside) => {
    let out = seg;
    if (inside !== undefined) {
      const shifted = shiftBracketRow(inside, action);
      out = shifted === null ? '#REF!' : `[${shifted}]`;
    }
    kept.push(out);
    return `\u0000${kept.length - 1}\u0000`;
  });
  return shiftPlainCoordinates(masked, action).replace(/\u0000(\d+)\u0000/g, (_m, i) => kept[Number(i)]);
}

/** 다른 표(tableNames 중 하나)에 행/열이 추가·삭제됐을 때 이 수식의 [표]!… 참조를 이동 */
export function shiftCrossTableRefs(expression: string, tableNames: string[], action: ShiftAction): string {
  if (!expression) return expression;
  return expression.replace(BRACKET_SEGMENT, (seg, table, crossInside, crossCoord) => {
    if (table === undefined || !tableNames.includes(table.trim())) return seg;
    if (crossCoord !== undefined) {
      const shifted = shiftPlainCoordinates(crossCoord, action);
      return shifted.includes('#REF!') ? '#REF!' : `[${table}]!${shifted}`;
    }
    const shifted = shiftBracketRow(crossInside, action);
    return shifted === null ? '#REF!' : `[${table}]![${shifted}]`;
  });
}

/** 수식 오류 칸 표시 */
export const FORMULA_ERROR = '#오류';

/** 잘못된 수식(괄호 불일치·없는 함수·빠진 피연산자 등) */
class FormulaError extends Error {}

/** 부동소수 오차 제거 — 소수 10자리에서 반올림 */
export function roundResult(n: number): number {
  return Number(n.toFixed(10));
}

/** 수식 안에 다시 끼워 넣을 숫자 문자열 (지수 표기 회피) */
function numToExpr(n: number): string {
  if (!Number.isFinite(n)) throw new FormulaError();
  const s = Math.abs(n) < 1e21 ? n.toFixed(10).replace(/\.?0+$/, '') : String(n);
  return n < 0 ? `(${s})` : s;
}

const FUNCTIONS: Record<string, (args: number[]) => number> = {
  SUM: (a) => a.reduce((x, y) => x + y, 0),
  AVERAGE: (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0),
  MIN: (a) => (a.length ? Math.min(...a) : 0),
  MAX: (a) => (a.length ? Math.max(...a) : 0),
  ROUND: (a) => {
    if (a.length < 1 || a.length > 2) throw new FormulaError();
    const f = Math.pow(10, Math.trunc(a[1] ?? 0));
    return Math.round(a[0] * f) / f;
  },
};

/** 셀 주소가 모두 숫자로 바뀐 식에서 함수·괄호를 안쪽부터 풀고 사칙연산 계산 */
function evaluateExpression(expr: string): number {
  let e = expr;
  const inner = /([A-Za-z]*)\s*\(([^()]*)\)/;
  for (let m = e.match(inner); m; m = e.match(inner)) {
    const name = m[1].toUpperCase();
    let val: number;
    if (name) {
      const fn = FUNCTIONS[name];
      if (!fn) throw new FormulaError();
      const args = m[2].trim() === '' ? [] : m[2].split(',').map((a) => evaluateArithmetic(a));
      val = fn(args);
    } else {
      if (m[2].includes(',')) throw new FormulaError();
      val = evaluateArithmetic(m[2]);
    }
    e = e.slice(0, m.index) + numToExpr(val) + e.slice((m.index ?? 0) + m[0].length);
  }
  return evaluateArithmetic(e);
}

/** 안전한 사칙연산 수식 평가기 (토큰 기반, eval 배제) — 잘못된 식은 FormulaError */
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
      throw new FormulaError();
    }
  }
  if (tokens.length === 0) throw new FormulaError();

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
      if (operatorStack.length === 0) throw new FormulaError(); // 닫는 괄호 짝 없음
      operatorStack.pop(); // '(' 제거
    } else {
      throw new FormulaError();
    }
  }

  while (operatorStack.length > 0) {
    const op = operatorStack.pop()!;
    if (op === '(') throw new FormulaError(); // 여는 괄호 짝 없음
    outputQueue.push(op);
  }

  // RPN 계산
  const evalStack: number[] = [];
  for (const item of outputQueue) {
    if (typeof item === 'number') {
      evalStack.push(item);
    } else {
      if (evalStack.length < 2) throw new FormulaError(); // 피연산자 빠짐
      const b = evalStack.pop()!;
      const a = evalStack.pop()!;
      let res = 0;
      if (item === '+') res = a + b;
      else if (item === '-') res = a - b;
      else if (item === '*') res = a * b;
      else if (item === '/') res = b === 0 ? 0 : a / b;
      evalStack.push(res);
    }
  }

  if (evalStack.length !== 1) throw new FormulaError();
  return evalStack[0];
}

/** from 행부터 조건에 맞는 첫 행 번호 (없으면 -1) — 예전 제목 행(0번)을 라벨 검색에서 빼기 위함 */
function findRowFrom<T>(rows: T[], from: number, pred: (row: T) => boolean): number {
  for (let i = Math.max(0, from); i < rows.length; i++) if (pred(rows[i])) return i;
  return -1;
}

export type OtherTablesContext = Record<
  string,
  {
    cols: string[];
    rows: Array<Record<string, string>>;
    headerValues?: Record<string, string>;
    merges?: CellMerge[];
    firstDataRow?: number; // 예전 제목 행을 0번 행으로 내린 표면 1
  }
>;

/**
 * 타 표의 셀/소계/합계 값 조회 헬퍼
 */
export function resolveOtherTableCell(
  tableName: string,
  targetRowOrCoord: string,
  targetColName?: string,
  otherTablesContext?: OtherTablesContext
): number {
  if (!otherTablesContext) return 0;
  const cleanTName = tableName.trim().replace(/\s+/g, '').toLowerCase();

  // 표 이름 또는 필드 키로 일치하는 표 탐색
  const matchEntry = Object.entries(otherTablesContext).find(([k]) => {
    const cleanK = k.trim().replace(/\s+/g, '').toLowerCase();
    return cleanK === cleanTName || cleanK.includes(cleanTName) || cleanTName.includes(cleanK);
  });
  if (!matchEntry) return 0;

  const otherTable = matchEntry[1];
  const { cols: oCols, rows: oRows, headerValues: oHeaders, merges: oMerges } = otherTable;
  const oFrom = otherTable.firstDataRow ?? 0;
  if (!oRows || oRows.length === 0 || !oCols || oCols.length === 0) return 0;

  const resolveOColKey = (title: string): string => {
    const trimmed = title.trim();
    if (oCols.includes(trimmed)) return trimmed;
    if (oHeaders) {
      const m = Object.keys(oHeaders).find((k) => oHeaders[k] === trimmed);
      if (m && oCols.includes(m)) return m;
    }
    const partial = oCols.find((c) => c.includes(trimmed) || trimmed.includes(c));
    if (partial) return partial;
    return trimmed;
  };

  // 1. 행과 열이 모두 지정된 경우: [행라벨:열이름]
  if (targetColName) {
    const colKey = resolveOColKey(targetColName);
    const rowToken = targetRowOrCoord.trim();
    let rIdx = -1;
    if (/^\d+$/.test(rowToken)) {
      rIdx = parseInt(rowToken, 10);
    } else if (rowToken.toUpperCase() === 'LAST') {
      rIdx = oRows.length - 1;
    } else {
      const targetLabel = rowToken.toLowerCase();
      rIdx = findRowFrom(oRows, oFrom, (r) =>
        Object.values(r).some(
          (val) => typeof val === 'string' && val.trim().toLowerCase() === targetLabel
        )
      );
      if (rIdx === -1) {
        rIdx = findRowFrom(oRows, oFrom, (r) =>
          Object.values(r).some(
            (val) => typeof val === 'string' && val.trim().toLowerCase().includes(targetLabel)
          )
        );
      }
    }
    if (rIdx >= 0 && rIdx < oRows.length) {
      // 병합 블록 안의 칸을 가리키면 대표 칸 값을 씀. 빈 칸은 0 (다른 열 값으로 대체하지 않음)
      const cIdx = oCols.indexOf(colKey);
      if (cIdx === -1) return parseCellNumber(oRows[rIdx][colKey]);
      const anchor = toMergeAnchor(rIdx, cIdx, oMerges);
      return parseCellNumber(oRows[anchor.rIdx]?.[oCols[anchor.cIdx]]);
    }
    return 0;
  }

  // 2. 단일 셀 좌표인 경우: "D4" 등
  const parsedCoord = coordToCell(targetRowOrCoord);
  if (parsedCoord) {
    const { rIdx, cIdx } = parsedCoord;
    if (rIdx >= 0 && rIdx < oRows.length && cIdx >= 0 && cIdx < oCols.length) {
      return parseCellNumber(oRows[rIdx][oCols[cIdx]]);
    }
    return 0;
  }

  // 3. 열 이름만 지정된 경우: [열이름] -> 소계/합계 행 우선 검색
  const colKey = resolveOColKey(targetRowOrCoord);
  if (oCols.includes(colKey)) {
    let rIdx = findRowFrom(oRows, oFrom, (r) =>
      Object.values(r).some(
        (val) =>
          typeof val === 'string' &&
          (val.trim().includes('소계') || val.trim().includes('합계'))
      )
    );
    if (rIdx === -1) rIdx = oRows.length - 1;
    return parseCellNumber(oRows[rIdx][colKey]);
  }

  // 4. 행 라벨만 지정된 경우: [소계] -> 금액 열 우선 검색
  const targetLabel = targetRowOrCoord.trim().toLowerCase();
  const rIdx = findRowFrom(oRows, oFrom, (r) =>
    Object.values(r).some(
      (val) => typeof val === 'string' && val.trim().toLowerCase().includes(targetLabel)
    )
  );
  if (rIdx >= 0) {
    const numCol =
      oCols.find(
        (c) =>
          c.includes('금액') ||
          c.includes('비용') ||
          c.includes('원') ||
          c.includes('합계')
      ) || oCols[oCols.length - 1];
    return parseCellNumber(oRows[rIdx][numCol]);
  }

  return 0;
}

/**
 * 테이블 전체 수식 일괄 실시간 재계산
 * - cols: 열 이름 배열 (예: ['구분', '비중', '금액', ...])
 * - rows: 행 데이터 배열
 * - cellFormulas: 키 "rIdx:colName" -> 수식 객체
 * - headerValues: 헤더 표시 텍스트 맵
 * - otherTablesContext: 문서 내 타 표 데이터 맵 (표 간 교차 참조용)
 * - 반환값: 수식 계산 결과가 반영된 새로운 rows 배열
 */
export function recalculateTableFormulas(
  cols: string[],
  rows: Array<Record<string, string>>,
  cellFormulas?: Record<string, CellFormula>,
  headerValues?: Record<string, string>,
  otherTablesContext?: OtherTablesContext,
  merges?: CellMerge[],
  opts?: { firstDataRow?: number }
): Array<Record<string, string>> {
  // 예전 제목 행을 0번 행으로 내린 표: 위쪽 합산·행 라벨 검색에서 제목 행 제외
  const firstDataRow = opts?.firstDataRow ?? 0;
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

    // 0. 타 표 참조 처리 (Cross-Table Reference: 예: [매출구분]![소계:금액], [매출구분]!D4, [매출구분]![발주금액])
    expr = expr.replace(/\[([^\]!]+)\]\s*!\s*\[([^\]]+)\]/g, (_m, rawTableName, rawInside) => {
      const cleanInside = rawInside.trim();
      if (cleanInside.includes(':')) {
        const [rowToken, colToken] = cleanInside.split(':');
        const val = resolveOtherTableCell(rawTableName, rowToken.trim(), colToken.trim(), otherTablesContext);
        return numToExpr(val);
      }
      const val = resolveOtherTableCell(rawTableName, cleanInside, undefined, otherTablesContext);
      return numToExpr(val);
    });

    expr = expr.replace(/\[([^\]!]+)\]\s*!\s*([A-Z]+\d+)/gi, (_m, rawTableName, coord) => {
      const val = resolveOtherTableCell(rawTableName, coord, undefined, otherTablesContext);
      return numToExpr(val);
    });

    // 1. SUM([열이름]) 처리: 지정된 열의 상단 모든 행 합산
    expr = expr.replace(/SUM\s*\(\s*\[([^\]]+)\]\s*\)/gi, (_m, rawColTitle) => {
      const actualCol = resolveColKey(rawColTitle);
      const cIdx = cols.indexOf(actualCol);
      let sum = 0;
      for (let r = firstDataRow; r < targetRowIdx; r++) {
        if (cIdx !== -1) {
          sum += getCellValue(r, cIdx);
        } else {
          sum += parseCellNumber(nextRows[r][actualCol]);
        }
      }
      return numToExpr(sum);
    });

    // 1. SUM(ABOVE) 처리: 현재 셀 위의 모든 행 합산
    expr = expr.replace(/SUM\s*\(\s*ABOVE\s*\)/gi, () => {
      let sum = 0;
      for (let r = firstDataRow; r < targetRowIdx; r++) {
        sum += getCellValue(r, targetColIdx);
      }
      return numToExpr(sum);
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
      return numToExpr(sum);
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
          r = findRowFrom(nextRows, firstDataRow, (row) =>
            Object.values(row).some(
              (val) => typeof val === 'string' && val.trim().toLowerCase() === targetLabel
            )
          );
          if (r === -1) {
            r = findRowFrom(nextRows, firstDataRow, (row) =>
              Object.values(row).some(
                (val) => typeof val === 'string' && val.trim().toLowerCase().includes(targetLabel)
              )
            );
          }
        }
        let actualCol = resolveColKey(cName);
        if (r >= 0 && r < nextRows.length) {
          // 병합 블록 안의 칸을 가리키면 대표 칸으로. 빈 칸은 0 (다른 열 값으로 대체하지 않음)
          const cIdx = cols.indexOf(actualCol);
          if (cIdx !== -1) {
            const anchor = toMergeAnchor(r, cIdx, merges);
            r = anchor.rIdx;
            actualCol = cols[anchor.cIdx];
          }
          const depKey = `${r}:${actualCol}`;
          if (cellFormulas[depKey] && !stack.has(depKey)) {
            return numToExpr(evaluateCellFormula(depKey, new Set(stack)));
          }
          return numToExpr(parseCellNumber(nextRows[r][actualCol]));
        }
        return '0';
      }

      const actualCol = resolveColKey(cleanToken);
      const isKnownCol =
        cols.includes(actualCol) ||
        (headerValues && Object.values(headerValues).includes(cleanToken));

      // 열 이름이 아니라 행 라벨인 경우 (예: [매입발주 금액])
      if (!isKnownCol) {
        const targetLabel = cleanToken.toLowerCase();
        let r = findRowFrom(nextRows, firstDataRow, (row) =>
          Object.values(row).some(
            (val) => typeof val === 'string' && val.trim().toLowerCase() === targetLabel
          )
        );
        if (r === -1) {
          r = findRowFrom(nextRows, firstDataRow, (row) =>
            Object.values(row).some(
              (val) => typeof val === 'string' && val.trim().toLowerCase().includes(targetLabel)
            )
          );
        }
        if (r >= 0 && r < nextRows.length) {
          for (const c of cols) {
            const depKey = `${r}:${c}`;
            if (cellFormulas[depKey] && !stack.has(depKey)) {
              return numToExpr(evaluateCellFormula(depKey, new Set(stack)));
            }
          }
          for (const c of cols) {
            const val = parseCellNumber(nextRows[r][c]);
            if (val !== 0) return numToExpr(val);
          }
          return '0';
        }
      }

      const depKey = `${targetRowIdx}:${actualCol}`;
      if (cellFormulas[depKey] && !stack.has(depKey)) {
        return numToExpr(evaluateCellFormula(depKey, new Set(stack)));
      }
      return numToExpr(parseCellNumber(nextRows[targetRowIdx][actualCol]));
    });

    // 3-1. SUM 외 함수 인자의 범위(A1:C1)를 셀 목록(A1,B1,C1)으로 펼침
    expr = expr.replace(/([A-Z]+)(\d+)\s*:\s*([A-Z]+)(\d+)/gi, (_m, c1, r1, c2, r2) => {
      let startCol = letterToColIndex(c1.toUpperCase());
      let endCol = letterToColIndex(c2.toUpperCase());
      let startRow = parseInt(r1, 10);
      let endRow = parseInt(r2, 10);
      if (startRow > endRow) [startRow, endRow] = [endRow, startRow];
      if (startCol > endCol) [startCol, endCol] = [endCol, startCol];
      const refs: string[] = [];
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) refs.push(`${colIndexToLetter(c)}${r}`);
      }
      return refs.join(',');
    });

    // 4. 단일 셀 참조 치환: 예) D27, H27
    expr = expr.replace(/([A-Z]+)(\d+)/gi, (_m, colStr, rowStr) => {
      const c = letterToColIndex(colStr.toUpperCase());
      const r = parseInt(rowStr, 10) - 1;
      if (r < 0 || r >= nextRows.length || c < 0 || c >= cols.length) return '0';

      const depColName = cols[c];
      const depKey = `${r}:${depColName}`;
      if (cellFormulas[depKey] && !stack.has(depKey)) {
        return numToExpr(evaluateCellFormula(depKey, new Set(stack)));
      }
      return numToExpr(getCellValue(r, c));
    });

    // 5. 함수·괄호·사칙연산 평가
    return evaluateExpression(expr);
  };

  // 모든 수식 셀을 차례대로 평가하여 적용
  formulaKeys.forEach((key) => {
    const [rIdxStr, colName] = key.split(':');
    const rIdx = parseInt(rIdxStr, 10);
    if (rIdx >= 0 && rIdx < nextRows.length && cols.includes(colName)) {
      const fInfo = cellFormulas[key];
      try {
        nextRows[rIdx][colName] = formatCellValue(roundResult(evaluateCellFormula(key)), fInfo?.format);
      } catch (e) {
        if (!(e instanceof FormulaError)) throw e;
        nextRows[rIdx][colName] = FORMULA_ERROR;
      }
    }
  });

  return nextRows;
}

/**
 * 서식 내 복수의 표 필드를 순회하며 타 표 교차 수식을 연쇄 실시간 재계산하는 헬퍼
 */
export function cascadeRecalculateAllTables(
  tableFields: Array<{ key: string; label: string; placeholder?: string; options?: string[] }>,
  currentVals: Record<string, any>,
  patch: Record<string, any>
): Record<string, any> {
  const mergedVals = { ...currentVals, ...patch };
  if (!tableFields || tableFields.length <= 1) return patch;

  // 모든 표의 현재 파싱 데이터 구성
  const allTablesData: Record<
    string,
    {
      cols: string[];
      rows: Array<Record<string, string>>;
      cellFormulas?: Record<string, CellFormula>;
      headerValues?: Record<string, string>;
      merges?: CellMerge[];
      raw: any;
    }
  > = {};

  tableFields.forEach((tf) => {
    const raw = mergedVals[tf.key] || tf.placeholder;
    if (raw && typeof raw === 'string') {
      try {
        const p = JSON.parse(raw);
        allTablesData[tf.key] = {
          cols: p.cols || tf.options || [],
          rows: p.rows || p.defaultRows || [],
          cellFormulas: p.cellFormulas,
          headerValues: p.headerValues,
          merges: Array.isArray(p.merges) ? p.merges : undefined,
          raw: p,
        };
      } catch (e) {}
    }
  });

  // 타 표 컨텍스트 맵 구성 (라벨 및 키 둘 다 매핑)
  const buildContext = (): OtherTablesContext => {
    const ctx: OtherTablesContext = {};
    tableFields.forEach((tf) => {
      const td = allTablesData[tf.key];
      if (td) {
        ctx[tf.label] = { cols: td.cols, rows: td.rows, headerValues: td.headerValues, merges: td.merges };
        ctx[tf.key] = { cols: td.cols, rows: td.rows, headerValues: td.headerValues, merges: td.merges };
      }
    });
    return ctx;
  };

  const finalPatch = { ...patch };

  // 수식을 가진 다른 표들 연쇄 재계산
  tableFields.forEach((tf) => {
    const td = allTablesData[tf.key];
    if (td && td.cellFormulas && Object.keys(td.cellFormulas).length > 0) {
      const hasCrossFormula = Object.values(td.cellFormulas).some(
        (f) => f.expression && f.expression.includes('!')
      );
      if (hasCrossFormula) {
        const ctx = buildContext();
        const nextRows = recalculateTableFormulas(
          td.cols,
          td.rows,
          td.cellFormulas,
          td.headerValues,
          ctx,
          td.merges
        );
        td.rows = nextRows;
        finalPatch[tf.key] = JSON.stringify({
          ...td.raw,
          rows: nextRows,
          defaultRows: nextRows,
        });
      }
    }
  });

  return finalPatch;
}

