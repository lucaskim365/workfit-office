/**
 * 엑셀(.xlsx) 불러오기 — 첫 번째 시트를 시트 모듈 형식으로 읽는다
 * - 값·병합·열 너비·행 높이·글꼴(굵게·기울임·밑줄·크기·색)·배경색·정렬·테두리·숫자 표시·수식
 * - 공유 수식은 칸마다 풀어 넣는다. 이 모듈이 계산하지 못하는 수식은 엑셀이 저장해 둔 값만 가져오고 알린다
 * - 색은 rgb·옛 색인 색·테마 색(밝기 조절 포함). 인쇄 영역이 있으면 그 안만
 * - 날짜 칸은 'YYYY-MM-DD' 글자로. 조건부 서식·그림·차트·메모는 가져오지 않는다
 */
import { colIndex, colLetter, translateFormula, valueText } from './formula';
import { cellKey, createSheet, recalculate, type BorderW, type CellStyle, type Merge, type Sheet } from './model';
import { child, children, find, parseXml, textOf, type XmlNode } from './xml';
import { unzip, ZipError } from './zip';

export class XlsxError extends Error {}

export interface XlsxImport {
  sheet: Sheet;
  /** 통합 문서의 시트 이름들(순서대로) — 보기 화면의 시트 탭 */
  sheetNames: string[];
  /** 사람이 읽을 안내 — 못 가져온 것, 잘라 낸 것 등 */
  warnings: string[];
}

export interface XlsxOptions {
  /** 이보다 크면 잘라 낸다 (기본 300행 × 60열) */
  maxRows?: number;
  maxCols?: number;
  /** 몇 번째 시트(0부터) — 없으면 첫 시트(시트가 여럿이면 안내를 남김) */
  sheet?: number;
  /** 인쇄 영역 밖 칸도 가져온다(파일 보기 화면) — 기본은 인쇄 영역까지(서식 만들기) */
  ignorePrintArea?: boolean;
}

/** 엑셀 기본 열 너비(8.43글자)를 픽셀로 */
const EXCEL_DEFAULT_COL_PX = 64;
const EXCEL_DEFAULT_ROW_PX = 20;

const charsToPx = (chars: number) => Math.round(chars * 7 + 5);
const pointsToPx = (pt: number) => Math.round((pt * 4) / 3);

/** 엑셀 옛 색인 색(indexed 0~63). 64·65 는 시스템 글자·배경색(자동) */
const INDEXED_COLORS = [
  '000000', 'ffffff', 'ff0000', '00ff00', '0000ff', 'ffff00', 'ff00ff', '00ffff',
  '000000', 'ffffff', 'ff0000', '00ff00', '0000ff', 'ffff00', 'ff00ff', '00ffff',
  '800000', '008000', '000080', '808000', '800080', '008080', 'c0c0c0', '808080',
  '9999ff', '993366', 'ffffcc', 'ccffff', '660066', 'ff8080', '0066cc', 'ccccff',
  '000080', 'ff00ff', 'ffff00', '00ffff', '800080', '800000', '008080', '0000ff',
  '00ccff', 'ccffff', 'ccffcc', 'ffff99', '99ccff', 'ff99cc', 'cc99ff', 'ffcc99',
  '3366ff', '33cccc', '99cc00', 'ffcc00', 'ff9900', 'ff6600', '666699', '969696',
  '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
];

/** 테마 색 목록 — 엑셀 theme 번호 순서(0 lt1, 1 dk1, 2 lt2, 3 dk2, 4~9 accent1~6, 10 hlink, 11 folHlink) */
/** 테마 파일이 없을 때 — 엑셀 기본(Office) 테마 */
const OFFICE_THEME = ['ffffff', '000000', 'eeece1', '1f497d', '4f81bd', 'c0504d', '9bbb59', '8064a2', '4bacc6', 'f79646', '0000ff', '800080'];

function readThemeColors(xml: XmlNode | undefined): string[] {
  const scheme = find(xml, 'clrScheme');
  if (!scheme) return OFFICE_THEME;
  const colorOf = (name: string) => {
    const n = child(scheme, name);
    const srgb = child(n, 'srgbClr')?.attrs.val;
    const sys = child(n, 'sysClr')?.attrs.lastClr;
    const hex = srgb ?? sys;
    return hex && /^[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : '';
  };
  return ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].map(colorOf);
}

/** 엑셀 tint(-1~1) — 밝기(HSL 의 L)만 바꾼다. 음수는 어둡게, 양수는 밝게 */
function applyTint(hex: string, tint: number): string {
  if (!tint) return hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

/**
 * 색 칸(<color>·<fgColor>) → '#rrggbb'. rgb·색인(indexed)·테마(theme + tint) 모두.
 * 읽을 수 없으면 null, 자동 색(auto·indexed 64/65)이면 'auto'
 */
function resolveColor(node: XmlNode | undefined, theme: string[]): string | null | 'auto' {
  if (!node) return null;
  const a = node.attrs;
  if (a.auto === '1' || a.auto === 'true') return 'auto';
  let hex: string | undefined;
  if (a.rgb && /^[0-9a-f]{6,8}$/i.test(a.rgb)) hex = a.rgb.slice(-6).toLowerCase();
  else if (a.indexed !== undefined) {
    const i = Number(a.indexed);
    if (i === 64 || i === 65) return 'auto';
    hex = INDEXED_COLORS[i];
  } else if (a.theme !== undefined) hex = theme[Number(a.theme)] || undefined;
  if (!hex) return null;
  const tint = Number(a.tint ?? 0);
  return `#${applyTint(hex, Number.isFinite(tint) ? Math.max(-1, Math.min(1, tint)) : 0)}`;
}

/** 숫자 서식 글자 → 소수 자릿수 (첫 구역만 본다, '0.0%' → 1, '#,##0' → 0) */
function decimalsOf(code: string): number {
  const first = code.split(';')[0].replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
  const m = first.match(/\.([0#]+)/);
  return m ? m[1].length : 0;
}

/** 기본 서식 번호의 서식 글자(소수 자릿수 판단용) */
const BUILTIN_CODES: Record<number, string> = { 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 37: '#,##0', 38: '#,##0', 39: '#,##0.00', 40: '#,##0.00' };

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

function readStyles(xml: XmlNode | undefined, theme: string[], warn: (msg: string) => void): XfStyle[] {
  const sheetStyle = find(xml, 'styleSheet');
  if (!sheetStyle) return [];
  const numFmts = new Map<number, string>();
  children(child(sheetStyle, 'numFmts'), 'numFmt').forEach((n) => numFmts.set(Number(n.attrs.numFmtId), n.attrs.formatCode));

  let unresolvedColor = false;
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
    const color = resolveColor(colorNode, theme);
    if (color === null && colorNode) unresolvedColor = true;
    // 검정·자동은 기본 글자색이라 따로 두지 않는다
    else if (color && color !== 'auto' && color !== '#000000') out.color = color;
    return out;
  });

  const fills = children(child(sheetStyle, 'fills'), 'fill').map((f) => {
    const pattern = child(f, 'patternFill');
    if (!pattern || pattern.attrs.patternType !== 'solid') return undefined;
    const fg = child(pattern, 'fgColor');
    const color = resolveColor(fg, theme);
    if (color === null && fg) unresolvedColor = true;
    // 흰색·자동 배경은 문서 바탕과 같으므로 두지 않는다(편집기 선택 표시를 가리지 않게)
    return color && color !== 'auto' && color !== '#ffffff' ? color : undefined;
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
    const sh = align?.attrs.shrinkToFit;
    if (sh === '1' || sh === 'true') style.shrink = true;
    const v = align?.attrs.vertical;
    if (v === 'top' || v === 'bottom') style.valign = v;
    else if (v === 'center') style.valign = 'middle';
    const numFmtId = Number(xf.attrs.numFmtId ?? 0);
    const code = numFmts.get(numFmtId) ?? BUILTIN_CODES[numFmtId];
    const numKind = numKindOf(numFmtId, code);
    if (numKind === 'currency' || numKind === 'percent') {
      style.numFmt = numKind;
      if (code) style.decimals = decimalsOf(code);
    } else if (numKind === 'general' && code && /^[#0,]*\.0+$/.test(code)) {
      style.decimals = decimalsOf(code); // '0.00' 처럼 자릿수만 정한 서식
    }
    return { style, numKind };
  });
  if (unresolvedColor) warn('읽을 수 없는 색 지정이 있어 일부 글자·배경색은 가져오지 못했습니다.');
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
function sheetPathOf(
  files: Map<string, Uint8Array>,
  decode: (b: Uint8Array) => string,
  warn: (msg: string) => void,
  index: number | undefined
): { path: string; names: string[]; index: number } {
  const workbook = files.get('xl/workbook.xml');
  if (!workbook) throw new XlsxError('엑셀 통합 문서(.xlsx)가 아닙니다.');
  const sheets = children(find(parseXml(decode(workbook)), 'sheets'), 'sheet');
  if (sheets.length === 0) throw new XlsxError('시트가 없는 파일입니다.');
  const names = sheets.map((s) => s.attrs.name ?? '');
  if (index === undefined && sheets.length > 1) warn(`시트가 ${sheets.length}개입니다. 첫 번째 시트('${sheets[0].attrs.name}')만 가져왔습니다.`);
  const at = index !== undefined && index >= 0 && index < sheets.length ? index : 0;
  const relId = sheets[at].attrs.id;
  const rels = files.get('xl/_rels/workbook.xml.rels');
  const target = rels ? children(find(parseXml(decode(rels)), 'Relationships'), 'Relationship').find((r) => r.attrs.Id === relId)?.attrs.Target : undefined;
  const path = !target ? `xl/worksheets/sheet${at + 1}.xml` : target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  return { path, names, index: at };
}

/**
 * 그 시트(기본 첫 시트)의 인쇄 영역 끝(행·열 수). 'Sheet1'!$A$1:$K$42 형식, 여러 구역이면 첫 구역.
 * 왼쪽 위가 A1 이 아니어도 끝만 쓴다(앞쪽을 잘라 내면 칸 위치가 엑셀과 달라짐)
 */
function printAreaOf(workbook: XmlNode | undefined, sheetIndex = 0): { rows: number; cols: number; ref: string } | null {
  const names = children(find(workbook, 'definedNames'), 'definedName');
  const area = names.find((n) => n.attrs.name === '_xlnm.Print_Area' && (n.attrs.localSheetId ?? '0') === String(sheetIndex));
  if (!area) return null;
  const first = textOf(area).split(',')[0];
  const ref = first.slice(first.lastIndexOf('!') + 1);
  const [a, b] = ref.split(':');
  const end = parseRef(b ?? a ?? '');
  if (!end) return null;
  return { rows: end[0] + 1, cols: end[1] + 1, ref: ref.replace(/\$/g, '') };
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

  const picked = sheetPathOf(files, decode, warn, opts.sheet);
  const sheetXml = xmlOf(picked.path);
  if (!sheetXml) throw new XlsxError('시트 내용을 찾을 수 없습니다.');
  const shared = readSharedStrings(xmlOf('xl/sharedStrings.xml'));
  const xfs = readStyles(xmlOf('xl/styles.xml'), readThemeColors(xmlOf('xl/theme/theme1.xml')), warn);
  const printArea = printAreaOf(xmlOf('xl/workbook.xml'), picked.index);
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
  // 인쇄 영역이 정해져 있으면 그 밖(메모·계산용 칸 등)은 서식에 넣지 않는다
  if (printArea && !opts.ignorePrintArea && (rowCount > printArea.rows || colCount > printArea.cols)) {
    rowCount = Math.min(rowCount, printArea.rows);
    colCount = Math.min(colCount, printArea.cols);
    warn(`엑셀의 인쇄 영역(${printArea.ref}) 밖에 있는 칸은 가져오지 않았습니다.`);
  }
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
  return { sheet: recalculate(s), sheetNames: picked.names, warnings };
}
