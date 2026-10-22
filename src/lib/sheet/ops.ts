/**
 * 시트 조작 (순수 함수, 입력 불변)
 * - 행·열 삽입/삭제 시 수식·서식·병합·행 높이·열 너비·부가 정보(cellMeta·rowMeta·colMeta)를 함께 이동
 * - 병합, 셀 서식·테두리, 값/수식 입력, 탭 구분 텍스트 붙여넣기, 부가 정보 설정
 */
import { shiftFormula, type ShiftAction } from './formula';
import { cellKey, newColKey, type CellStyle, type Merge, type MetaMap, type Sheet } from './model';

export interface CellRange {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export type BorderPreset = 'all' | 'outer' | 'thickOuter' | 'none';

type RowMap = (r: number) => number | null;

/** "r:colKey" 키 맵의 행 번호를 바꿈 — null이면 그 키 제거 */
function remapCellKeys<T>(rec: Record<string, T>, map: RowMap): Record<string, T> {
  const out: Record<string, T> = {};
  Object.entries(rec).forEach(([key, v]) => {
    const i = key.indexOf(':');
    const r = map(Number(key.slice(0, i)));
    if (r !== null) out[`${r}${key.slice(i)}`] = v;
  });
  return out;
}

/** 행 번호 키 맵의 키를 바꿈 — null이면 제거 */
function remapRowKeys<T>(rec: Record<string, T>, map: RowMap): Record<string, T> {
  const out: Record<string, T> = {};
  Object.entries(rec).forEach(([key, v]) => {
    const r = map(Number(key));
    if (r !== null) out[String(r)] = v;
  });
  return out;
}

/** "r:colKey" 키 맵에서 특정 열 키 제거 */
function dropColKeys<T>(rec: Record<string, T>, col: string): Record<string, T> {
  const out: Record<string, T> = {};
  Object.entries(rec).forEach(([key, v]) => {
    if (key.slice(key.indexOf(':') + 1) !== col) out[key] = v;
  });
  return out;
}

/** 이름공간마다 같은 변환을 적용하고, 비게 된 이름공간은 지움 */
function mapMeta(meta: MetaMap, fn: (rec: Record<string, unknown>) => Record<string, unknown>): MetaMap {
  const out: MetaMap = {};
  Object.entries(meta).forEach(([ns, rec]) => {
    const next = fn(rec);
    if (Object.keys(next).length > 0) out[ns] = next;
  });
  return out;
}

function shiftExpressions(formulas: Record<string, string>, action: ShiftAction): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(formulas).forEach(([k, f]) => (out[k] = shiftFormula(f, action)));
  return out;
}

/** 병합 블록 한 축(시작·길이)을 삽입/삭제에 맞게 조정 */
function shiftSpan(start: number, span: number, at: number, add: boolean): [number, number] {
  if (add) {
    if (at <= start) return [start + 1, span];
    if (at < start + span) return [start, span + 1];
    return [start, span];
  }
  if (at < start) return [start - 1, span];
  if (at < start + span) return [start, span - 1];
  return [start, span];
}

function cleanMerges(merges: Merge[]): Merge[] {
  return merges.filter((m) => m.rowSpan > 0 && m.colSpan > 0 && m.rowSpan * m.colSpan > 1);
}

function rowMapper(at: number, add: boolean): RowMap {
  return (r) => {
    if (add) return r >= at ? r + 1 : r;
    if (r === at) return null;
    return r > at ? r - 1 : r;
  };
}

function shiftRows(s: Sheet, at: number, add: boolean): Sheet {
  const map = rowMapper(at, add);
  const rows = s.rows.map((r) => ({ ...r }));
  if (add) rows.splice(at, 0, Object.fromEntries(s.cols.map((c) => [c, ''])));
  else rows.splice(at, 1);
  return {
    ...s,
    rows,
    rowHeights: remapRowKeys(s.rowHeights, map),
    formulas: shiftExpressions(remapCellKeys(s.formulas, map), { type: add ? 'row_add' : 'row_del', atIndex: at }),
    styles: remapCellKeys(s.styles, map),
    cellMeta: mapMeta(s.cellMeta, (rec) => remapCellKeys(rec, map)),
    rowMeta: mapMeta(s.rowMeta, (rec) => remapRowKeys(rec, map)),
    merges: cleanMerges(
      s.merges.map((m) => {
        const [startRow, rowSpan] = shiftSpan(m.startRow, m.rowSpan, at, add);
        return { ...m, startRow, rowSpan };
      })
    ),
  };
}

export function insertRow(s: Sheet, at: number): Sheet {
  return shiftRows(s, at, true);
}

export function deleteRow(s: Sheet, at: number): Sheet {
  return shiftRows(s, at, false);
}

function shiftMergeCols(merges: Merge[], at: number, add: boolean): Merge[] {
  return cleanMerges(
    merges.map((m) => {
      const [startCol, colSpan] = shiftSpan(m.startCol, m.colSpan, at, add);
      return { ...m, startCol, colSpan };
    })
  );
}

/** 새 열 키는 화면에 보이지 않는 무작위 키 — 키 기반 맵은 옮길 필요 없음 */
export function insertCol(s: Sheet, at: number): Sheet {
  const key = newColKey(s.cols);
  const cols = [...s.cols];
  cols.splice(at, 0, key);
  return {
    ...s,
    cols,
    rows: s.rows.map((r) => ({ ...r, [key]: '' })),
    formulas: shiftExpressions(s.formulas, { type: 'col_add', atIndex: at }),
    merges: shiftMergeCols(s.merges, at, true),
  };
}

export function deleteCol(s: Sheet, at: number): Sheet {
  const key = s.cols[at];
  if (key === undefined) return s;
  const { [key]: _w, ...colWidths } = s.colWidths;
  return {
    ...s,
    cols: s.cols.filter((_, i) => i !== at),
    rows: s.rows.map((r) => {
      const { [key]: _drop, ...rest } = r;
      return rest;
    }),
    colWidths,
    formulas: shiftExpressions(dropColKeys(s.formulas, key), { type: 'col_del', atIndex: at }),
    styles: dropColKeys(s.styles, key),
    cellMeta: mapMeta(s.cellMeta, (rec) => dropColKeys(rec, key)),
    colMeta: mapMeta(s.colMeta, (rec) => {
      const { [key]: _m, ...rest } = rec;
      return rest;
    }),
    merges: shiftMergeCols(s.merges, at, false),
  };
}

function normRange(g: CellRange): CellRange {
  return {
    r1: Math.min(g.r1, g.r2),
    r2: Math.max(g.r1, g.r2),
    c1: Math.min(g.c1, g.c2),
    c2: Math.max(g.c1, g.c2),
  };
}

function eachCell(range: CellRange, fn: (r: number, c: number) => void) {
  const { r1, r2, c1, c2 } = normRange(range);
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) fn(r, c);
}

function intersects(m: Merge, g: CellRange): boolean {
  return m.startRow <= g.r2 && m.startRow + m.rowSpan - 1 >= g.r1 && m.startCol <= g.c2 && m.startCol + m.colSpan - 1 >= g.c1;
}

/** 범위를 하나로 병합 — 걸친 병합은 흡수, 대표(왼쪽 위) 칸 외 값·수식은 지움(엑셀과 같음) */
export function mergeRange(s: Sheet, range: CellRange): Sheet {
  const g = normRange(range);
  if (g.r1 === g.r2 && g.c1 === g.c2) return s;
  const rows = s.rows.map((r) => ({ ...r }));
  const formulas = { ...s.formulas };
  eachCell(g, (r, c) => {
    if (r === g.r1 && c === g.c1) return;
    const col = s.cols[c];
    if (rows[r] && col !== undefined) rows[r][col] = '';
    delete formulas[cellKey(r, col)];
  });
  return {
    ...s,
    rows,
    formulas,
    merges: [
      ...s.merges.filter((m) => !intersects(m, g)),
      { startRow: g.r1, startCol: g.c1, rowSpan: g.r2 - g.r1 + 1, colSpan: g.c2 - g.c1 + 1 },
    ],
  };
}

export function unmergeAt(s: Sheet, r: number, c: number): Sheet {
  return { ...s, merges: s.merges.filter((m) => !intersects(m, { r1: r, r2: r, c1: c, c2: c })) };
}

/** '='로 시작하면 수식(계산은 recalculate가), 아니면 값 + 기존 수식 제거. allowFormula false면 항상 값 */
export function setCellValue(s: Sheet, r: number, c: number, text: string, opts?: { allowFormula?: boolean }): Sheet {
  const col = s.cols[c];
  if (col === undefined || !s.rows[r]) return s;
  const key = cellKey(r, col);
  const formulas = { ...s.formulas };
  const rows = s.rows.map((row, i) => (i === r ? { ...row } : row));
  if (opts?.allowFormula !== false && text.trim().startsWith('=')) {
    formulas[key] = text.trim();
  } else {
    delete formulas[key];
    rows[r][col] = text;
  }
  return { ...s, rows, formulas };
}

function mergeStyle(base: CellStyle | undefined, patch: Partial<CellStyle>): CellStyle {
  const out: CellStyle = { ...(base ?? {}), ...patch };
  (Object.keys(out) as Array<keyof CellStyle>).forEach((k) => {
    if (out[k] === undefined) delete out[k];
  });
  return out;
}

/** 범위의 각 칸에 서식 덮어쓰기 — 값이 undefined인 항목은 지움 */
export function applyStyle(s: Sheet, range: CellRange, patch: Partial<CellStyle>): Sheet {
  const styles = { ...s.styles };
  eachCell(range, (r, c) => {
    const key = cellKey(r, s.cols[c]);
    const next = mergeStyle(styles[key], patch);
    if (Object.keys(next).length > 0) styles[key] = next;
    else delete styles[key];
  });
  return { ...s, styles };
}

/** 엑셀 테두리 버튼과 같은 4가지 — 바깥 테두리는 안쪽 변을 건드리지 않음 */
export function applyBorder(s: Sheet, range: CellRange, preset: BorderPreset): Sheet {
  const g = normRange(range);
  const styles = { ...s.styles };
  eachCell(g, (r, c) => {
    const key = cellKey(r, s.cols[c]);
    const cur = styles[key] ?? {};
    let border = { ...(cur.border ?? {}) };
    if (preset === 'all') border = { t: 'thin', r: 'thin', b: 'thin', l: 'thin' };
    else if (preset === 'none') border = { t: 'none', r: 'none', b: 'none', l: 'none' };
    else {
      const w = preset === 'thickOuter' ? 'thick' : 'thin';
      if (r === g.r1) border.t = w;
      if (r === g.r2) border.b = w;
      if (c === g.c1) border.l = w;
      if (c === g.c2) border.r = w;
    }
    if (Object.keys(border).length > 0) styles[key] = { ...cur, border };
  });
  return { ...s, styles };
}

/** 엑셀 등에서 복사한 탭 구분 텍스트를 (r, c)부터 붙여넣기 — 넘치면 행·열 추가 */
export function pasteTsv(s: Sheet, r: number, c: number, text: string): Sheet {
  const lines = text.replace(/\r?\n$/, '').split(/\r?\n/).map((l) => l.split('\t'));
  const width = Math.max(...lines.map((l) => l.length));
  let next = s;
  while (next.rows.length < r + lines.length) next = insertRow(next, next.rows.length);
  while (next.cols.length < c + width) next = insertCol(next, next.cols.length);
  lines.forEach((cells, i) => cells.forEach((v, j) => (next = setCellValue(next, r + i, c + j, v))));
  return next;
}

/** 이름공간 ns의 key 값 설정 — undefined면 지우고, 비면 이름공간도 지움 */
function setMeta(meta: MetaMap, ns: string, key: string, value: unknown): MetaMap {
  const rec = { ...(meta[ns] ?? {}) };
  if (value === undefined) delete rec[key];
  else rec[key] = value;
  const out = { ...meta };
  if (Object.keys(rec).length > 0) out[ns] = rec;
  else delete out[ns];
  return out;
}

export function setCellMeta(s: Sheet, ns: string, r: number, c: number, value: unknown): Sheet {
  const col = s.cols[c];
  if (col === undefined) return s;
  return { ...s, cellMeta: setMeta(s.cellMeta, ns, cellKey(r, col), value) };
}

export function setRowMeta(s: Sheet, ns: string, r: number, value: unknown): Sheet {
  return { ...s, rowMeta: setMeta(s.rowMeta, ns, String(r), value) };
}

export function setColMeta(s: Sheet, ns: string, c: number, value: unknown): Sheet {
  const col = s.cols[c];
  if (col === undefined) return s;
  return { ...s, colMeta: setMeta(s.colMeta, ns, col, value) };
}
