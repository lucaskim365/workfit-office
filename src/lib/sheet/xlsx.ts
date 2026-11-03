/**
 * 엑셀(.xlsx) 불러오기 — 첫 번째 시트를 시트 모듈 형식으로 읽는다
 * - 값·병합·열 너비·행 높이·글꼴(굵게·기울임·밑줄·크기·색)·배경색·정렬·테두리·숫자 표시·수식
 * - 공유 수식은 칸마다 풀어 넣는다. 이 모듈이 계산하지 못하는 수식은 엑셀이 저장해 둔 값만 가져오고 알린다
 * - 날짜 칸은 'YYYY-MM-DD' 글자로. 테마 색·조건부 서식·그림·차트·메모는 가져오지 않는다
 */
import { colIndex, colLetter, translateFormula, valueText } from './formula';
import { cellKey, createSheet, recalculate, type BorderW, type CellStyle, type Merge, type Sheet } from './model';
import { child, children, find, parseXml, textOf, type XmlNode } from './xml';
import { unzip, ZipError } from './zip';

export class XlsxError extends Error {}

export interface XlsxImport {
  sheet: Sheet;
  /** 사람이 읽을 안내 — 못 가져온 것, 잘라 낸 것 등 */
  warnings: string[];
}

export interface XlsxOptions {
  /** 이보다 크면 잘라 낸다 (기본 300행 × 60열) */
  maxRows?: number;
  maxCols?: number;
}

/** 엑셀 기본 열 너비(8.43글자)를 픽셀로 */
const EXCEL_DEFAULT_COL_PX = 64;
const EXCEL_DEFAULT_ROW_PX = 20;

const charsToPx = (chars: number) => Math.round(chars * 7 + 5);
const pointsToPx = (pt: number) => Math.round((pt * 4) / 3);

/** 'FFRRGGBB'·'RRGGBB' → '#rrggbb'. 테마·색인 색은 null */
function rgbColor(node: XmlNode | undefined): string | null {
  const rgb = node?.attrs.rgb;
  if (!rgb || !/^[0-9a-f]{6,8}$/i.test(rgb)) return null;
  return `#${rgb.slice(-6).toLowerCase()}`;
}

function borderWidth(node: XmlNode | undefined): BorderW | undefined {
  const style = node?.attrs.style;
  if (!style || style === 'none') return undefined;
  return ['medium', 'thick', 'double', 'mediumDashed', 'mediumDashDot', 'mediumDashDotDot', 'slantDashDot'].includes(style) ? 'thick' : 'thin';
}

type NumKind = 'general' | 'currency' | 'percent' | 'date';

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

function numKindOf(id: number, code: string | undefined): NumKind {
  if ([9, 10].includes(id)) return 'percent';
  if ([3, 4, 37, 38, 39, 40].includes(id)) return 'currency';
  if (BUILTIN_DATE_FORMATS.has(id)) return 'date';
  if (!code) return 'general';
  // 따옴표 글자·색 지정([Red])을 빼고 본다
  const bare = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
  if (bare.includes('%')) return 'percent';
  if (/[yd]/i.test(bare) || /m{1,4}.*[d]|[d].*m{1,4}/i.test(bare)) return 'date';
  if (bare.includes('#,##0') || bare.includes('#,###')) return 'currency';
  return 'general';
}

/** 엑셀 날짜 일련번호 → 'YYYY-MM-DD' (1900 날짜 체계) */
function serialToDate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400000);
  return new Date(ms).toISOString().slice(0, 10);
}

interface XfStyle {
  style: CellStyle;
  numKind: NumKind;
}

function readStyles(xml: XmlNode | undefined, warn: (msg: string) => void): XfStyle[] {
  const sheetStyle = find(xml, 'styleSheet');
  if (!sheetStyle) return [];
  const numFmts = new Map<number, string>();
  children(child(sheetStyle, 'numFmts'), 'numFmt').forEach((n) => numFmts.set(Number(n.attrs.numFmtId), n.attrs.formatCode));

  let themeColorSeen = false;
  const fonts = children(child(sheetStyle, 'fonts'), 'font').map((f): CellStyle => {
    const out: CellStyle = {};
    const b = child(f, 'b');
    if (b && b.attrs.val !== '0' && b.attrs.val !== 'false') out.bold = true;
    const it = child(f, 'i');
    if (it && it.attrs.val !== '0' && it.attrs.val !== 'false') out.italic = true;
    const u = child(f, 'u');
    if (u && u.attrs.val !== 'none') out.underline = true;
    const sz = Number(child(f, 'sz')?.attrs.val);
    if (Number.isFinite(sz) && sz > 0 && sz !== 11) out.fontSize = sz;
    const colorNode = child(f, 'color');
    const color = rgbColor(colorNode);
    if (color && color !== '#000000') out.color = color;
    else if (colorNode?.attrs.theme && colorNode.attrs.theme !== '1') themeColorSeen = true;
    return out;
  });

  const fills = children(child(sheetStyle, 'fills'), 'fill').map((f) => {
    const pattern = child(f, 'patternFill');
    if (!pattern || pattern.attrs.patternType !== 'solid') return undefined;
    const fg = child(pattern, 'fgColor');
    const color = rgbColor(fg);
    if (!color && fg?.attrs.theme) themeColorSeen = true;
    return color ?? undefined;
  });

  const borders = children(child(sheetStyle, 'borders'), 'border').map((b) => {
    const t = borderWidth(child(b, 'top'));
    const r = borderWidth(child(b, 'right'));
    const bb = borderWidth(child(b, 'bottom'));
    const l = borderWidth(child(b, 'left'));
    return t || r || bb || l ? { t, r, b: bb, l } : undefined;
  });

  const xfs = children(child(sheetStyle, 'cellXfs'), 'xf').map((xf): XfStyle => {
    const style: CellStyle = { ...(fonts[Number(xf.attrs.fontId ?? 0)] ?? {}) };
    const bg = fills[Number(xf.attrs.fillId ?? 0)];
    if (bg) style.bg = bg;
    const border = borders[Number(xf.attrs.borderId ?? 0)];
    if (border) {
      const clean = Object.fromEntries(Object.entries(border).filter(([, v]) => v !== undefined)) as CellStyle['border'];
      if (clean && Object.keys(clean).length > 0) style.border = clean;
    }
    const align = child(xf, 'alignment');
    const h = align?.attrs.horizontal;
    if (h === 'left' || h === 'right') style.align = h;
    else if (h === 'center' || h === 'centerContinuous') style.align = 'center';
    const v = align?.attrs.vertical;
    if (v === 'top' || v === 'bottom') style.valign = v;
    else if (v === 'center') style.valign = 'middle';
    const numFmtId = Number(xf.attrs.numFmtId ?? 0);
    const numKind = numKindOf(numFmtId, numFmts.get(numFmtId));
    if (numKind === 'currency' || numKind === 'percent') style.numFmt = numKind;
    return { style, numKind };
  });
  if (themeColorSeen) warn('테마 색으로 지정된 글자·배경색 일부는 가져오지 못했습니다.');
  return xfs;
}

function readSharedStrings(xml: XmlNode | undefined): string[] {
  return children(find(xml, 'sst'), 'si').map((si) => {
    // 서식 있는 글(<r><t>)과 일반 글(<t>) 모두. 발음 표기(<rPh>)는 뺀다
    const runs = si.children.filter((c) => c.name === 't' || c.name === 'r');
    return runs.map((c) => (c.name === 't' ? textOf(c) : textOf(child(c, 't')))).join('');
  });
}

/** 'B3' → [행, 열] (0부터) */
function parseRef(ref: string): [number, number] | null {
  const m = ref.match(/^\$?([A-Z]{1,3})\$?(\d+)$/i);
  return m ? [Number(m[2]) - 1, colIndex(m[1])] : null;
}

/** workbook.xml 의 첫 시트가 가리키는 파일 경로 */
function firstSheetPath(files: Map<string, Uint8Array>, decode: (b: Uint8Array) => string, warn: (msg: string) => void): string {
  const workbook = files.get('xl/workbook.xml');
  if (!workbook) throw new XlsxError('엑셀 통합 문서(.xlsx)가 아닙니다.');
  const sheets = children(find(parseXml(decode(workbook)), 'sheets'), 'sheet');
  if (sheets.length === 0) throw new XlsxError('시트가 없는 파일입니다.');
  if (sheets.length > 1) warn(`시트가 ${sheets.length}개입니다. 첫 번째 시트('${sheets[0].attrs.name}')만 가져왔습니다.`);
  const relId = sheets[0].attrs.id;
  const rels = files.get('xl/_rels/workbook.xml.rels');
  const target = rels ? children(find(parseXml(decode(rels)), 'Relationships'), 'Relationship').find((r) => r.attrs.Id === relId)?.attrs.Target : undefined;
  if (!target) return 'xl/worksheets/sheet1.xml';
  return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
}

/** .xlsx 바이트 → 시트 */
export async function importXlsx(bytes: Uint8Array, opts: XlsxOptions = {}): Promise<XlsxImport> {
  const maxRows = opts.maxRows ?? 300;
  const maxCols = opts.maxCols ?? 60;
  const warnings: string[] = [];
  const warn = (msg: string) => {
    if (!warnings.includes(msg)) warnings.push(msg);
  };

  let files: Map<string, Uint8Array>;
  try {
    files = await unzip(bytes);
  } catch (e) {
    if (e instanceof ZipError) throw new XlsxError(e.message === 'ZIP 파일이 아닙니다.' ? '엑셀 통합 문서(.xlsx)가 아닙니다. .xls 파일은 엑셀에서 .xlsx 로 다시 저장해 주세요.' : e.message);
    throw e;
  }
  const decoder = new TextDecoder();
  const decode = (b: Uint8Array) => decoder.decode(b);
  const xmlOf = (path: string) => {
    const b = files.get(path);
    return b ? parseXml(decode(b)) : undefined;
  };

  const sheetPath = firstSheetPath(files, decode, warn);
  const sheetXml = xmlOf(sheetPath);
  if (!sheetXml) throw new XlsxError('시트 내용을 찾을 수 없습니다.');
  const shared = readSharedStrings(xmlOf('xl/sharedStrings.xml'));
  const xfs = readStyles(xmlOf('xl/styles.xml'), warn);
  const ws = find(sheetXml, 'worksheet') ?? sheetXml;

  // ── 칸 읽기 ──
  interface RawCell {
    r: number;
    c: number;
    value: string;
    formula?: string;
    xf: number;
  }
  const cells: RawCell[] = [];
  const sharedMasters = new Map<string, { formula: string; r: number; c: number }>();
  const pendingShared: Array<RawCell & { si: string }> = [];

  for (const row of children(child(ws, 'sheetData'), 'row')) {
    for (const c of children(row, 'c')) {
      const pos = parseRef(c.attrs.r ?? '');
      if (!pos) continue;
      const [r, col] = pos;
      const xf = Number(c.attrs.s ?? 0);
      const t = c.attrs.t;
      const v = child(c, 'v');
      let value = '';
      if (t === 's') value = shared[Number(textOf(v))] ?? '';
      else if (t === 'inlineStr') value = textOf(child(c, 'is'));
      else if (t === 'b') value = textOf(v) === '1' ? 'TRUE' : 'FALSE';
      else if (t === 'e') value = '';
      else if (v) {
        const raw = textOf(v);
        const n = Number(raw);
        value = t === 'str' || !Number.isFinite(n) ? raw : xfs[xf]?.numKind === 'date' ? serialToDate(n) : valueText(n);
      }
      const f = child(c, 'f');
      const cell: RawCell = { r, c: col, value, xf };
      let shareFollower = false;
      if (f) {
        const text = textOf(f).trim();
        if (f.attrs.t === 'shared' && f.attrs.si !== undefined) {
          if (text) {
            sharedMasters.set(f.attrs.si, { formula: text, r, c: col });
            cell.formula = text;
          } else {
            // 같은 객체를 cells 에도 넣으므로 아래에서 수식을 채우면 그대로 반영된다
            pendingShared.push(Object.assign(cell, { si: f.attrs.si }));
            shareFollower = true;
          }
        } else if (f.attrs.t === 'array') {
          warn('배열 수식은 계산하지 않고 저장된 값만 가져왔습니다.');
        } else if (text) cell.formula = text;
      }
      if (value === '' && !cell.formula && !shareFollower && xf === 0) continue;
      cells.push(cell);
    }
  }
  // 공유 수식 풀기 — 주인 칸 수식을 위치 차이만큼 옮긴다
  for (const p of pendingShared) {
    const master = sharedMasters.get(p.si);
    if (master) p.formula = translateFormula(master.formula, p.r - master.r, p.c - master.c);
  }

  // ── 병합 ──
  const merges: Merge[] = [];
  for (const m of children(child(ws, 'mergeCells'), 'mergeCell')) {
    const [a, b] = (m.attrs.ref ?? '').split(':');
    const p1 = parseRef(a ?? '');
    const p2 = parseRef(b ?? a ?? '');
    if (!p1 || !p2) continue;
    const startRow = Math.min(p1[0], p2[0]);
    const startCol = Math.min(p1[1], p2[1]);
    merges.push({ startRow, startCol, rowSpan: Math.abs(p2[0] - p1[0]) + 1, colSpan: Math.abs(p2[1] - p1[1]) + 1 });
  }

  // 글꼴만 바꾼 빈 칸이 문서 끝까지 이어진 경우가 많아, 값·수식·테두리·배경·병합이 있는 곳까지만 쓴다
  // (테두리만 그린 빈 칸은 입력 줄일 수 있어 남긴다)
  const visible = (x: RawCell) => x.value !== '' || !!x.formula || !!xfs[x.xf]?.style.border || !!xfs[x.xf]?.style.bg;
  let contentRow = -1;
  let contentCol = -1;
  for (const x of cells) {
    if (!visible(x)) continue;
    contentRow = Math.max(contentRow, x.r);
    contentCol = Math.max(contentCol, x.c);
  }
  for (const m of merges) {
    contentRow = Math.max(contentRow, m.startRow + m.rowSpan - 1);
    contentCol = Math.max(contentCol, m.startCol + m.colSpan - 1);
  }
  let rowCount = contentRow + 1;
  let colCount = contentCol + 1;
  if (rowCount <= 0 || colCount <= 0) throw new XlsxError('시트에 내용이 없습니다.');
  if (rowCount > maxRows) {
    warn(`행이 ${rowCount}개라 ${maxRows}행까지만 가져왔습니다.`);
    rowCount = maxRows;
  }
  if (colCount > maxCols) {
    warn(`열이 ${colCount}개라 ${colLetter(maxCols - 1)}열까지만 가져왔습니다.`);
    colCount = maxCols;
  }

  // ── 시트 만들기 ──
  const s = createSheet(rowCount, colCount);
  const format = child(ws, 'sheetFormatPr');
  const defaultColPx = format?.attrs.defaultColWidth ? charsToPx(Number(format.attrs.defaultColWidth)) : EXCEL_DEFAULT_COL_PX;
  const defaultRowPx = format?.attrs.defaultRowHeight ? pointsToPx(Number(format.attrs.defaultRowHeight)) : EXCEL_DEFAULT_ROW_PX;
  s.cols.forEach((col) => (s.colWidths[col] = defaultColPx));
  for (const c of children(child(ws, 'cols'), 'col')) {
    const min = Number(c.attrs.min) - 1;
    const max = Number(c.attrs.max) - 1;
    const width = Number(c.attrs.width);
    if (!Number.isFinite(width)) continue;
    const px = c.attrs.hidden === '1' || c.attrs.hidden === 'true' ? 0 : charsToPx(width);
    for (let i = Math.max(0, min); i <= Math.min(max, colCount - 1); i++) s.colWidths[s.cols[i]] = px;
  }
  for (const row of children(child(ws, 'sheetData'), 'row')) {
    const r = Number(row.attrs.r) - 1;
    if (r < 0 || r >= rowCount) continue;
    const ht = Number(row.attrs.ht);
    if (row.attrs.hidden === '1' || row.attrs.hidden === 'true') s.rowHeights[String(r)] = 0;
    else if (Number.isFinite(ht) && pointsToPx(ht) !== defaultRowPx) s.rowHeights[String(r)] = pointsToPx(ht);
  }
  if (Object.values(s.colWidths).some((w) => w === 0) || Object.values(s.rowHeights).some((h) => h === 0)) {
    warn('숨긴 행·열은 높이·너비 0으로 가져왔습니다.');
  }

  for (const cell of cells) {
    if (cell.r >= rowCount || cell.c >= colCount) continue;
    const col = s.cols[cell.c];
    s.rows[cell.r][col] = cell.value;
    if (cell.formula) s.formulas[cellKey(cell.r, col)] = `=${cell.formula}`;
    const style = xfs[cell.xf]?.style;
    if (style && Object.keys(style).length > 0) s.styles[cellKey(cell.r, col)] = { ...style };
  }
  s.merges = merges.filter((m) => m.startRow < rowCount && m.startCol < colCount).map((m) => ({
    ...m,
    rowSpan: Math.min(m.rowSpan, rowCount - m.startRow),
    colSpan: Math.min(m.colSpan, colCount - m.startCol),
  }));

  // ── 계산 확인 — 못 푸는 수식은 엑셀이 저장한 값으로 ──
  const computed = recalculate(s);
  const unsupported: string[] = [];
  for (const key of Object.keys(s.formulas)) {
    const i = key.indexOf(':');
    const r = Number(key.slice(0, i));
    const col = key.slice(i + 1);
    if (computed.rows[r][col] === '#오류') {
      unsupported.push(`${colLetter(s.cols.indexOf(col))}${r + 1}`);
      delete s.formulas[key];
    }
  }
  if (unsupported.length > 0) {
    const list = unsupported.slice(0, 10).join(', ') + (unsupported.length > 10 ? ` 외 ${unsupported.length - 10}칸` : '');
    warn(`계산할 수 없는 수식이 있어 저장된 값만 가져왔습니다: ${list}`);
  }
  return { sheet: recalculate(s), warnings };
}
