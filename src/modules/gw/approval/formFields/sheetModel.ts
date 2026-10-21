/**
 * 결재서식 표 시트 모델 (버전 2)
 * - 표 값(JSON 문자열)의 새 형식 정의와 예전 형식 읽기 변환
 * - 예전 형식은 읽을 때 메모리에서만 변환하고, DB 값은 사용자가 편집해 저장할 때만 새 형식이 됨
 */
import type { CellMerge } from './utils';
import {
  recalculateTableFormulas,
  shiftFormulaCoordinates,
  shiftCrossTableRefs,
  type CellFormula,
  type OtherTablesContext,
} from './formulaEngine';

export type BorderW = 'none' | 'thin' | 'thick';

export interface CellStyle {
  bold?: boolean;
  color?: string; // 팔레트 토큰
  bg?: string; // 팔레트 토큰
  align?: 'left' | 'center' | 'right';
  numFmt?: 'general' | 'currency' | 'percent';
  border?: { t?: BorderW; r?: BorderW; b?: BorderW; l?: BorderW };
}

export interface SheetPayload {
  version: 2;
  cols: string[]; // 내부 열 키
  rows: Array<Record<string, string>>;
  colWidths: Record<string, string>;
  tableWidth: string;
  merges: CellMerge[];
  cellFormulas: Record<string, CellFormula>; // "r:colKey"
  cellStyles: Record<string, CellStyle>; // "r:colKey"
  secretCols: string[];
  secretCells: string[]; // "r:colKey"
  secretRows: number[];
  headerValues?: Record<string, string>; // 예전 수식 열 제목 해석용 별칭 — 화면에 그리지 않음
  legacyHeaderRow?: boolean; // 0번 행이 예전 제목 행 → 위쪽 합산·행 라벨 검색에서 제외
  sumCell?: { rIdx: number; col: string } | null; // 예전 표에만
  amountCells?: Array<{ rIdx: number; col: string }>; // 예전 표에만
  baseSig?: string;
}

const DEFAULT_COLS = ['구분', '항목', '내용'];
const LEGACY_HEADER_STYLE: CellStyle = { bold: true, bg: 'gray', align: 'center' };

function parseRaw(raw: unknown): any {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw && typeof raw === 'object' ? raw : {};
}

function pickRows(p: any): Array<Record<string, string>> {
  if (Array.isArray(p.rows) && p.rows.length > 0) return p.rows;
  if (Array.isArray(p.defaultRows) && p.defaultRows.length > 0) return p.defaultRows;
  if (Array.isArray(p.rows)) return p.rows;
  return Array.isArray(p.defaultRows) ? p.defaultRows : [];
}

/** 식에 나오는 타 표 이름들 ([표]!…) */
function crossTableNames(expr: string): string[] {
  return Array.from(expr.matchAll(/\[([^\]!]+)\]\s*!/g), (m) => m[1].trim());
}

/** 예전 형식 값(제목 행 별도)을 버전 2로 — 제목 행을 0번 행으로 내리고 모든 행 좌표 +1 */
function convertLegacy(p: any, cols: string[]): SheetPayload {
  const headerValues: Record<string, string> = p.headerValues ?? {};
  const headerRow: Record<string, string> = {};
  const cellStyles: Record<string, CellStyle> = {};
  cols.forEach((c) => {
    headerRow[c] = headerValues[c] ?? c;
    cellStyles[`0:${c}`] = { ...LEGACY_HEADER_STYLE };
  });

  const shift = { type: 'row_add' as const, atIndex: 0 };
  const cellFormulas: Record<string, CellFormula> = {};
  Object.entries((p.cellFormulas ?? {}) as Record<string, CellFormula>).forEach(([key, f]) => {
    const [r, col] = key.split(':');
    let expression = shiftFormulaCoordinates(f.expression, shift);
    // 예전 표의 타 표 참조는 예전(제목 행 없는) 표를 기준으로 쓰였으므로 함께 +1
    expression = shiftCrossTableRefs(expression, crossTableNames(expression), shift);
    cellFormulas[`${Number(r) + 1}:${col}`] = { ...f, expression };
  });

  const amountCells: Array<{ rIdx: number; col: string }> = Array.isArray(p.amountCells)
    ? p.amountCells
    : p.amountCell
    ? [p.amountCell]
    : [];

  return {
    version: 2,
    cols,
    rows: [headerRow, ...pickRows(p).map((r) => ({ ...r }))],
    colWidths: p.colWidths ?? {},
    tableWidth: p.tableWidth ?? '100%',
    merges: ((p.merges ?? []) as CellMerge[]).map((m) => ({ ...m, startRow: m.startRow + 1 })),
    cellFormulas,
    cellStyles,
    secretCols: Array.isArray(p.secretCols) ? p.secretCols : [],
    // 예전 비공개 칸 키는 "행:열순서" → "행:열키"
    secretCells: (Array.isArray(p.secretCells) ? (p.secretCells as string[]) : []).flatMap((k) => {
      const [r, c] = k.split(':').map(Number);
      return cols[c] !== undefined ? [`${r + 1}:${cols[c]}`] : [];
    }),
    secretRows: (Array.isArray(p.secretRows) ? (p.secretRows as number[]) : []).map((r) => r + 1),
    headerValues,
    legacyHeaderRow: true,
    sumCell: p.sumCell ? { ...p.sumCell, rIdx: p.sumCell.rIdx + 1 } : null,
    amountCells: amountCells.map((a) => ({ ...a, rIdx: a.rIdx + 1 })),
    ...(p.baseSig ? { baseSig: p.baseSig } : {}),
  };
}

/** 표 값(문자열 JSON·객체·없음)을 버전 2 시트로 */
export function normalizeTablePayload(raw: unknown, fallbackCols?: string[]): SheetPayload {
  const p = parseRaw(raw);
  const cols: string[] =
    Array.isArray(p.cols) && p.cols.length > 0
      ? p.cols
      : Array.isArray(p.options) && p.options.length > 0
      ? p.options
      : fallbackCols && fallbackCols.length > 0
      ? fallbackCols
      : DEFAULT_COLS;

  if (p.version !== 2) return convertLegacy(p, cols);

  const sheet: SheetPayload = {
    version: 2,
    cols,
    rows: pickRows(p),
    colWidths: p.colWidths ?? {},
    tableWidth: p.tableWidth ?? '100%',
    merges: p.merges ?? [],
    cellFormulas: p.cellFormulas ?? {},
    cellStyles: p.cellStyles ?? {},
    secretCols: p.secretCols ?? [],
    secretCells: p.secretCells ?? [],
    secretRows: p.secretRows ?? [],
  };
  if (p.headerValues) sheet.headerValues = p.headerValues;
  if (p.legacyHeaderRow) sheet.legacyHeaderRow = true;
  if (p.sumCell) sheet.sumCell = p.sumCell;
  if (Array.isArray(p.amountCells) && p.amountCells.length > 0) sheet.amountCells = p.amountCells;
  if (p.baseSig) sheet.baseSig = p.baseSig;
  return sheet;
}

/** 저장용 JSON — 예전 읽기 코드 호환을 위해 defaultRows도 함께 기록 */
export function serializeSheet(p: SheetPayload): string {
  return JSON.stringify({ ...p, defaultRows: p.rows });
}

/** 구조(열·행 수, 수식, 병합, 서식, 비공개) 해시 — 칸 값은 제외 */
export function sheetSignature(p: SheetPayload): string {
  const text = JSON.stringify([
    p.cols,
    p.rows.length,
    p.cellFormulas,
    p.merges,
    p.cellStyles,
    p.secretCols,
    p.secretCells,
    p.secretRows,
  ]);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function firstDataRowOf(p: SheetPayload): number {
  return p.legacyHeaderRow ? 1 : 0;
}

/** 수식 재계산 + 예전 합계 칸 자동 합산 */
export function recalculateSheet(p: SheetPayload, others?: Record<string, SheetPayload>): SheetPayload {
  const ctx: OtherTablesContext = {};
  Object.entries(others ?? {}).forEach(([name, o]) => {
    ctx[name] = { cols: o.cols, rows: o.rows, headerValues: o.headerValues, merges: o.merges, firstDataRow: firstDataRowOf(o) };
  });
  const from = firstDataRowOf(p);
  let rows = recalculateTableFormulas(p.cols, p.rows, p.cellFormulas, p.headerValues, ctx, p.merges, {
    firstDataRow: from,
  });

  const sumCell = p.sumCell;
  if (sumCell && rows[sumCell.rIdx]) {
    const amountCells = p.amountCells ?? [];
    let sum = 0;
    rows.forEach((r, idx) => {
      if (idx < from) return;
      p.cols.forEach((c) => {
        if (sumCell.rIdx === idx && sumCell.col === c) return;
        if (c.includes('금액') || amountCells.some((ac) => ac.rIdx === idx && ac.col === c)) {
          sum += Number(String(r[c] ?? '').replace(/[^0-9]/g, '')) || 0;
        }
      });
    });
    rows = rows.map((r, idx) => (idx === sumCell.rIdx ? { ...r, [sumCell.col]: sum > 0 ? String(sum) : '' } : r));
  }
  return { ...p, rows };
}
