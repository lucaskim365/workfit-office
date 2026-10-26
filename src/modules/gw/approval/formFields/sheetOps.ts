/**
 * 결재서식 표 시트 조작 (순수 함수, 입력 불변)
 * - 행·열 삽입/삭제 시 수식·서식·병합·비공개·예전 합계 칸을 함께 이동
 * - 병합, 셀 서식·테두리, 값/수식 입력, 탭 구분 텍스트 붙여넣기
 */
import type { CellMerge } from './utils';
import type { CellStyle, SheetPayload } from './sheetModel';
import { shiftFormulaCoordinates, shiftCrossTableRefs, type ShiftAction, type CellFormula } from './formulaEngine';

export interface CellRange {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export type BorderPreset = 'all' | 'outer' | 'thickOuter' | 'none';

/** "r:colKey" 키 맵의 행 번호를 바꿈 — mapRow가 null이면 그 키 제거 */
function remapRowKeys<T>(rec: Record<string, T>, mapRow: (r: number) => number | null): Record<string, T> {
  const out: Record<string, T> = {};
  Object.entries(rec).forEach(([key, v]) => {
    const i = key.indexOf(':');
    const r = mapRow(Number(key.slice(0, i)));
    if (r !== null) out[`${r}${key.slice(i)}`] = v;
  });
  return out;
}

/** "r:colKey" 키 맵에서 특정 열 키 제거 */
function dropColKeys<T>(rec: Record<string, T>, colKey: string): Record<string, T> {
  const out: Record<string, T> = {};
  Object.entries(rec).forEach(([key, v]) => {
    if (key.slice(key.indexOf(':') + 1) !== colKey) out[key] = v;
  });
  return out;
}

function keyList(keys: string[]): Record<string, true> {
  return Object.fromEntries(keys.map((k) => [k, true as const]));
}

function shiftExpressions(formulas: Record<string, CellFormula>, action: ShiftAction): Record<string, CellFormula> {
  const out: Record<string, CellFormula> = {};
  Object.entries(formulas).forEach(([k, f]) => {
    out[k] = { ...f, expression: shiftFormulaCoordinates(f.expression, action) };
  });
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

function cleanMerges(merges: CellMerge[]): CellMerge[] {
  return merges.filter((m) => m.rowSpan > 0 && m.colSpan > 0 && m.rowSpan * m.colSpan > 1);
}

function rowMapper(at: number, add: boolean) {
  return (r: number): number | null => {
    if (add) return r >= at ? r + 1 : r;
    if (r === at) return null;
    return r > at ? r - 1 : r;
  };
}

function shiftRows(p: SheetPayload, at: number, add: boolean): SheetPayload {
  const map = rowMapper(at, add);
  const action: ShiftAction = { type: add ? 'row_add' : 'row_del', atIndex: at };
  const rows = p.rows.map((r) => ({ ...r }));
  if (add) rows.splice(at, 0, Object.fromEntries(p.cols.map((c) => [c, ''])));
  else rows.splice(at, 1);

  const next: SheetPayload = {
    ...p,
    rows,
    cellFormulas: shiftExpressions(remapRowKeys(p.cellFormulas, map), action),
    cellStyles: remapRowKeys(p.cellStyles, map),
    secretCells: Object.keys(remapRowKeys(keyList(p.secretCells), map)),
    secretRows: p.secretRows.flatMap((r) => {
      const m = map(r);
      return m === null ? [] : [m];
    }),
    merges: cleanMerges(
      p.merges.map((m) => {
        const [startRow, rowSpan] = shiftSpan(m.startRow, m.rowSpan, at, add);
        return { ...m, startRow, rowSpan };
      })
    ),
  };
  if (p.sumCell) {
    const r = map(p.sumCell.rIdx);
    next.sumCell = r === null ? null : { ...p.sumCell, rIdx: r };
  }
  if (p.amountCells) {
    next.amountCells = p.amountCells.flatMap((a) => {
      const r = map(a.rIdx);
      return r === null ? [] : [{ ...a, rIdx: r }];
    });
  }
  return next;
}

export function insertRow(p: SheetPayload, at: number): SheetPayload {
  return shiftRows(p, at, true);
}

export function deleteRow(p: SheetPayload, at: number): SheetPayload {
  return shiftRows(p, at, false);
}

function newColKey(existing: string[]): string {
  for (;;) {
    const key = `c_${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`;
    if (!existing.includes(key)) return key;
  }
}

function shiftMergeCols(merges: CellMerge[], at: number, add: boolean): CellMerge[] {
  return cleanMerges(
    merges.map((m) => {
      const [startCol, colSpan] = shiftSpan(m.startCol, m.colSpan, at, add);
      return { ...m, startCol, colSpan };
    })
  );
}

/** 새 열 키는 화면에 보이지 않는 무작위 키 */
export function insertCol(p: SheetPayload, at: number): SheetPayload {
  const key = newColKey(p.cols);
  const cols = [...p.cols];
  cols.splice(at, 0, key);
  return {
    ...p,
    cols,
    rows: p.rows.map((r) => ({ ...r, [key]: '' })),
    cellFormulas: shiftExpressions(p.cellFormulas, { type: 'col_add', atIndex: at }),
    merges: shiftMergeCols(p.merges, at, true),
  };
}

export function deleteCol(p: SheetPayload, at: number): SheetPayload {
  const key = p.cols[at];
  if (key === undefined) return p;
  const colWidths = { ...p.colWidths };
  delete colWidths[key];
  const next: SheetPayload = {
    ...p,
    cols: p.cols.filter((_, i) => i !== at),
    rows: p.rows.map((r) => {
      const { [key]: _drop, ...rest } = r;
      return rest;
    }),
    colWidths,
    cellFormulas: shiftExpressions(dropColKeys(p.cellFormulas, key), { type: 'col_del', atIndex: at }),
    cellStyles: dropColKeys(p.cellStyles, key),
    secretCells: Object.keys(dropColKeys(keyList(p.secretCells), key)),
    secretCols: p.secretCols.filter((c) => c !== key),
    merges: shiftMergeCols(p.merges, at, false),
  };
  if (p.sumCell?.col === key) next.sumCell = null;
  if (p.amountCells) next.amountCells = p.amountCells.filter((a) => a.col !== key);
  return next;
}

function normRange(range: CellRange): CellRange {
  return {
    r1: Math.min(range.r1, range.r2),
    r2: Math.max(range.r1, range.r2),
    c1: Math.min(range.c1, range.c2),
    c2: Math.max(range.c1, range.c2),
  };
}

function eachCell(range: CellRange, fn: (r: number, c: number) => void) {
  const { r1, r2, c1, c2 } = normRange(range);
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) fn(r, c);
}

function intersects(m: CellMerge, g: CellRange): boolean {
  return (
    m.startRow <= g.r2 && m.startRow + m.rowSpan - 1 >= g.r1 && m.startCol <= g.c2 && m.startCol + m.colSpan - 1 >= g.c1
  );
}

/** 범위를 하나로 병합 — 걸친 병합은 흡수, 대표(왼쪽 위) 칸 외 값·수식은 지움(엑셀과 같음) */
export function mergeRange(p: SheetPayload, range: CellRange): SheetPayload {
  const g = normRange(range);
  if (g.r1 === g.r2 && g.c1 === g.c2) return p;
  const rows = p.rows.map((r) => ({ ...r }));
  const cellFormulas = { ...p.cellFormulas };
  eachCell(g, (r, c) => {
    if (r === g.r1 && c === g.c1) return;
    const col = p.cols[c];
    if (rows[r] && col !== undefined) rows[r][col] = '';
    delete cellFormulas[`${r}:${col}`];
  });
  return {
    ...p,
    rows,
    cellFormulas,
    merges: [
      ...p.merges.filter((m) => !intersects(m, g)),
      { startRow: g.r1, startCol: g.c1, rowSpan: g.r2 - g.r1 + 1, colSpan: g.c2 - g.c1 + 1 },
    ],
  };
}

export function unmergeAt(p: SheetPayload, r: number, c: number): SheetPayload {
  return { ...p, merges: p.merges.filter((m) => !intersects(m, { r1: r, r2: r, c1: c, c2: c })) };
}

/** '='로 시작하면 수식(기존 표시 형식 유지), 아니면 값 + 기존 수식 제거 */
export function setCellValue(p: SheetPayload, r: number, c: number, text: string): SheetPayload {
  const col = p.cols[c];
  if (col === undefined || !p.rows[r]) return p;
  const key = `${r}:${col}`;
  const cellFormulas = { ...p.cellFormulas };
  const rows = p.rows.map((row, i) => (i === r ? { ...row } : row));
  if (text.trim().startsWith('=')) {
    cellFormulas[key] = { expression: text.trim(), format: p.cellFormulas[key]?.format ?? 'number' };
  } else {
    delete cellFormulas[key];
    rows[r][col] = text;
  }
  return { ...p, rows, cellFormulas };
}

function mergeStyle(base: CellStyle | undefined, patch: Partial<CellStyle>): CellStyle {
  const out: CellStyle = { ...(base ?? {}), ...patch };
  (Object.keys(out) as Array<keyof CellStyle>).forEach((k) => {
    if (out[k] === undefined) delete out[k];
  });
  return out;
}

/** 범위의 각 칸에 서식 덮어쓰기 — 값이 undefined인 항목은 지움 */
export function applyStyle(p: SheetPayload, range: CellRange, patch: Partial<CellStyle>): SheetPayload {
  const cellStyles = { ...p.cellStyles };
  eachCell(range, (r, c) => {
    const key = `${r}:${p.cols[c]}`;
    const next = mergeStyle(cellStyles[key], patch);
    if (Object.keys(next).length > 0) cellStyles[key] = next;
    else delete cellStyles[key];
  });
  return { ...p, cellStyles };
}

/** 엑셀 테두리 버튼과 같은 4가지 — 바깥 테두리는 안쪽 변을 건드리지 않음 */
export function applyBorder(p: SheetPayload, range: CellRange, preset: BorderPreset): SheetPayload {
  const g = normRange(range);
  const cellStyles = { ...p.cellStyles };
  eachCell(g, (r, c) => {
    const key = `${r}:${p.cols[c]}`;
    const cur = cellStyles[key] ?? {};
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
    if (Object.keys(border).length > 0) cellStyles[key] = { ...cur, border };
  });
  return { ...p, cellStyles };
}

/** 엑셀 등에서 복사한 탭 구분 텍스트를 (r, c)부터 붙여넣기 — 넘치면 행·열 추가 */
export function pasteTsv(p: SheetPayload, r: number, c: number, text: string): SheetPayload {
  const lines = text.replace(/\r?\n$/, '').split(/\r?\n/).map((l) => l.split('\t'));
  const width = Math.max(...lines.map((l) => l.length));
  let next = p;
  while (next.rows.length < r + lines.length) next = insertRow(next, next.rows.length);
  while (next.cols.length < c + width) next = insertCol(next, next.cols.length);
  lines.forEach((cells, i) => cells.forEach((v, j) => (next = setCellValue(next, r + i, c + j, v))));
  return next;
}

export function setSecretCell(p: SheetPayload, r: number, c: number, on: boolean): SheetPayload {
  const key = `${r}:${p.cols[c]}`;
  const rest = p.secretCells.filter((k) => k !== key);
  return { ...p, secretCells: on ? [...rest, key] : rest };
}

/** 표 changedKey에 행·열이 추가·삭제됐을 때 같은 문서 다른 표의 [라벨]!/[key]! 참조를 이동 */
export function propagateStructureChange(
  tables: Record<string, SheetPayload>,
  labels: Record<string, string>,
  changedKey: string,
  action: ShiftAction
): Record<string, SheetPayload> {
  const names = [changedKey, labels[changedKey]].filter((n): n is string => !!n);
  const out: Record<string, SheetPayload> = {};
  Object.entries(tables).forEach(([key, t]) => {
    if (key === changedKey) {
      out[key] = t;
      return;
    }
    const cellFormulas: Record<string, CellFormula> = {};
    Object.entries(t.cellFormulas).forEach(([k, f]) => {
      cellFormulas[k] = { ...f, expression: shiftCrossTableRefs(f.expression, names, action) };
    });
    out[key] = { ...t, cellFormulas };
  });
  return out;
}
