/**
 * 시트 데이터 구조 — 값·병합·서식·열 너비·행 높이·수식 + 이름공간별 부가 정보
 * - 칸 키는 "행번호:열키". 열 키는 화면에 보이지 않는 내부 키, 주소(A1)는 위치로 계산
 * - 부가 정보(cellMeta·rowMeta·colMeta)의 뜻은 쓰는 쪽이 정하고, 이 모듈은 행·열이 움직일 때 키만 옮긴다
 */
import { evaluateFormula, valueText, FormulaError, FORMULA_ERROR, type SheetValue } from './formula';

export interface Merge {
  startRow: number;
  startCol: number;
  rowSpan: number;
  colSpan: number;
}

export type BorderW = 'none' | 'thin' | 'thick';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number; // pt
  color?: string; // '#rrggbb'
  bg?: string; // '#rrggbb'
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  numFmt?: 'general' | 'currency' | 'percent';
  border?: { t?: BorderW; r?: BorderW; b?: BorderW; l?: BorderW };
}

/** 이름공간 → 키 → 값 */
export type MetaMap = Record<string, Record<string, unknown>>;

export interface Sheet {
  version: 1;
  cols: string[];
  rows: Array<Record<string, string>>; // 수식 칸은 계산 결과
  colWidths: Record<string, number>; // 열 키 → px
  rowHeights: Record<string, number>; // 행 번호 → px
  merges: Merge[];
  formulas: Record<string, string>; // "r:colKey" → '=A1+B1'
  styles: Record<string, CellStyle>; // "r:colKey"
  cellMeta: MetaMap; // 키 "r:colKey"
  rowMeta: MetaMap; // 키 행 번호
  colMeta: MetaMap; // 키 열 키
}

export const DEFAULT_COL_WIDTH = 96;
export const DEFAULT_ROW_HEIGHT = 28;

export function cellKey(r: number, col: string): string {
  return `${r}:${col}`;
}

/** 'c_' + 영숫자 6자, 기존 키와 겹치지 않음 */
export function newColKey(existing: string[]): string {
  for (;;) {
    const key = `c_${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`;
    if (!existing.includes(key)) return key;
  }
}

export function createSheet(rowCount = 30, colCount = 8): Sheet {
  const cols: string[] = [];
  for (let i = 0; i < colCount; i++) cols.push(newColKey(cols));
  return {
    version: 1,
    cols,
    rows: Array.from({ length: rowCount }, () => Object.fromEntries(cols.map((c) => [c, '']))),
    colWidths: {},
    rowHeights: {},
    merges: [],
    formulas: {},
    styles: {},
    cellMeta: {},
    rowMeta: {},
    colMeta: {},
  };
}

const obj = <T>(v: unknown): T => (v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : ({} as T));

/** 저장된 값(JSON 문자열·객체) → 시트. 이 모듈 형식이 아니면 null */
export function parseSheet(raw: unknown): Sheet | null {
  let p: any = raw;
  if (typeof raw === 'string') {
    try {
      p = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!p || typeof p !== 'object' || p.version !== 1 || !Array.isArray(p.cols) || !Array.isArray(p.rows)) return null;
  return {
    version: 1,
    cols: p.cols,
    rows: p.rows,
    colWidths: obj(p.colWidths),
    rowHeights: obj(p.rowHeights),
    merges: Array.isArray(p.merges) ? p.merges : [],
    formulas: obj(p.formulas),
    styles: obj(p.styles),
    cellMeta: obj(p.cellMeta),
    rowMeta: obj(p.rowMeta),
    colMeta: obj(p.colMeta),
  };
}

export function serializeSheet(s: Sheet): string {
  return JSON.stringify(s);
}

/** 병합 블록의 대표(왼쪽 위)가 아닌 칸인지 */
function isCovered(merges: Merge[], r: number, c: number): boolean {
  return merges.some(
    (m) =>
      r >= m.startRow &&
      r < m.startRow + m.rowSpan &&
      c >= m.startCol &&
      c < m.startCol + m.colSpan &&
      !(r === m.startRow && c === m.startCol)
  );
}

const ERR = Symbol('err');

/**
 * 모든 수식 칸을 다시 계산해 rows에 결과를 적는다 (입력은 바꾸지 않음)
 * - 병합에 가려진 칸은 엑셀처럼 빈 칸으로 읽음 (기존 결재 표 v2는 대표 칸 값을 읽었음 — 다른 규칙)
 * - 순환 참조는 0, 오류 칸을 참조한 칸도 오류
 */
export function recalculate(s: Sheet): Sheet {
  const rows = s.rows.map((r) => ({ ...r }));
  const memo = new Map<string, SheetValue | typeof ERR>();
  const stack = new Set<string>();

  const valueOf = (key: string): SheetValue => {
    const hit = memo.get(key);
    if (hit === ERR) throw new FormulaError();
    if (hit !== undefined) return hit;
    if (stack.has(key)) return 0;
    stack.add(key);
    try {
      const v = evaluateFormula(s.formulas[key], get);
      memo.set(key, v);
      return v;
    } catch (e) {
      if (e instanceof FormulaError) memo.set(key, ERR);
      throw e;
    } finally {
      stack.delete(key);
    }
  };

  const get = (r: number, c: number): SheetValue => {
    const col = s.cols[c];
    if (col === undefined || r < 0 || r >= s.rows.length || isCovered(s.merges, r, c)) return '';
    const key = cellKey(r, col);
    if (s.formulas[key] !== undefined) return valueOf(key);
    return s.rows[r][col] ?? '';
  };

  Object.keys(s.formulas).forEach((key) => {
    const i = key.indexOf(':');
    const r = Number(key.slice(0, i));
    const col = key.slice(i + 1);
    if (!rows[r] || !s.cols.includes(col)) return;
    try {
      rows[r][col] = valueText(valueOf(key));
    } catch (e) {
      if (!(e instanceof FormulaError)) throw e;
      rows[r][col] = FORMULA_ERROR;
    }
  });
  return { ...s, rows };
}

/** 구조 해시 — 칸 값·열 너비·행 높이는 제외 */
export function sheetSignature(s: Sheet): string {
  const text = JSON.stringify([s.cols, s.rows.length, s.formulas, s.merges, s.styles, s.cellMeta, s.rowMeta, s.colMeta]);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
