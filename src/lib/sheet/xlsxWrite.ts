/**
 * 엑셀(.xlsx) 내보내기 — 외부 라이브러리 없이 시트를 엑셀 파일로 만든다(불러오기 xlsx.ts 의 반대).
 * 담는 것: 값(숫자는 숫자로), 수식(계산된 값과 함께, 고를 때만), 병합, 열 너비·행 높이,
 *          글자(굵게·기울임·밑줄·크기·색), 배경색, 정렬, 숫자 표시(금액·백분율), 테두리, 줄바꿈.
 * 그림(PNG·JPEG)은 칸 위치에 띄운다(직인·로고·결재란 등 — 쓰는 쪽이 그림을 만들어 넘긴다).
 * 시트 한 장 = 엑셀 시트 한 장. 문자열은 칸 안에 바로 넣는다(inlineStr — 공유 문자열 표 없이).
 */
import { colLetter, parseNumber } from './formula';
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, cellKey, type CellStyle, type Sheet } from './model';
import { textWidth } from './style';
import { zip } from './zip';

/** 엑셀에서 쓰는 글꼴 — 글 폭도 이 글꼴로 잰다 */
const EXCEL_FONT = '맑은 고딕';
/** 칸보다 긴 글 — wrap: 줄바꿈(줄 높이가 두 줄 이상 될 때), shrink: 칸에 맞춰 글씨 줄이기 */
type Fit = 'wrap' | 'shrink' | null;
const EXCEL_FONT_CSS = "'Malgun Gothic', '맑은 고딕', sans-serif";
/** 칸 안쪽 여백(px) — 엑셀은 글 양옆에 조금씩 비운다 */
const EXCEL_CELL_PAD = 7;

export interface XlsxExportOptions {
  /** 엑셀 아래 시트 탭 이름(31자까지, 엑셀이 못 쓰는 글자는 뺌) */
  sheetName?: string;
  /** 빼고 내보낼 행(숨은 행·조건으로 숨긴 행 등). 빼면 아래 행이 올라오므로 수식은 값으로만 담는다 */
  skipRow?: (r: number) => boolean;
  /** 칸 글자를 바꿔 담기(예: 비공개 칸은 '비공개', 자동 채우기 칸은 그 값). undefined 면 시트 값 그대로 */
  cellText?: (r: number, c: number) => string | undefined;
  /** 수식도 담기(기본 false — 계산된 값만). 행을 빼면 무시하고 값만 */
  formulas?: boolean;
  /** 줄 높이(px)를 바꿔 담기 — 화면에서 글이 줄바꿈돼 늘어난 높이 등. undefined 면 시트 높이 */
  rowHeight?: (r: number) => number | undefined;
  /** 칸 위치에 띄울 그림 — 빼는 행에 걸린 그림은 뺀다 */
  pictures?: XlsxPicture[];
}

/**
 * 칸 위치에 띄우는 그림. 자리는 (r, c) 칸의 왼쪽 위에서 x·y(px, 시트 기준)만큼 — 음수나 칸보다 큰 값이면 옆·위·아래 칸으로 넘어간다.
 * 크기도 시트 px(열 너비·행 높이와 같은 단위)
 */
export interface XlsxPicture {
  r: number;
  c: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data: Uint8Array;
  type: 'png' | 'jpeg';
}

/** px → 엑셀 도형 단위(EMU, 96dpi 기준 1px = 9525) */
const EMU = 9525;

/** 엑셀 기본 글자 크기(pt) — 화면 기본(12px = 9pt)과 같게(크게 하면 좁은 칸 글자가 잘린다) */
const DEFAULT_PT = 9;
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** XML 글자 — 특수 문자를 바꾸고 XML 에 못 넣는 제어 문자는 뺀다 */
function esc(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** '#rrggbb' → 엑셀 ARGB 'FFRRGGBB'. 못 읽으면 undefined */
function argb(color: string | undefined): string | undefined {
  const m = /^#?([0-9a-f]{6})$/i.exec(color ?? '');
  return m ? `FF${m[1].toUpperCase()}` : undefined;
}

/** 시트 탭 이름 — 엑셀 규칙(31자, : \ / ? * [ ] 금지) */
function safeSheetName(name: string | undefined): string {
  const n = (name ?? '').replace(/[:\\/?*[\]]/g, ' ').trim().replace(/^'+|'+$/g, '').trim().slice(0, 31);
  return n || 'Sheet1';
}

/** 숫자로 담을 글자인가 — '0123'·'010-…' 같은 번호는 글자로(앞 0이 지워지지 않게) */
function asNumber(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^[+-]?0\d/.test(t.replace(/,/g, ''))) return null;
  const n = parseNumber(t);
  return n !== null && Number.isFinite(n) ? n : null;
}

/** 소수 자릿수(최대 10) — 표시 서식의 자릿수를 정하지 않은 칸 */
function decimalsOf(n: number): number {
  const s = String(Math.round(n * 1e10) / 1e10);
  const i = s.indexOf('.');
  return i < 0 || s.includes('e') ? 0 : Math.min(10, s.length - i - 1);
}

/** 숫자 표시 서식 코드 — 화면 표시(style.ts displayValue)와 같게 */
function numFmtCode(style: CellStyle | undefined, n: number | null): string | undefined {
  if (!style?.numFmt || style.numFmt === 'general' || n === null) return undefined;
  if (style.numFmt === 'currency') {
    const d = style.decimals ?? decimalsOf(n);
    return d > 0 ? `#,##0.${'0'.repeat(d)}` : '#,##0';
  }
  const d = style.decimals ?? Math.min(2, decimalsOf(n * 100));
  return d > 0 ? `0.${'0'.repeat(d)}%` : '0%';
}

/** 엑셀 서식 표(styles.xml) — 글꼴·채우기·테두리·칸 서식을 겹치지 않게 모은다 */
class StyleBook {
  /**
   * 0번 글꼴 = 통합 문서 기본(표준 스타일) — 엑셀은 열 너비 단위를 이 글꼴의 숫자 폭으로 잰다.
   * 엑셀 표준(Calibri 11, 숫자 폭 7px)으로 둬야 픽셀 → 글자 수 환산((px-5)/7)이 맞는다.
   * (맑은 고딕 9pt 로 두면 숫자 폭이 6px 이라 열이 6/7 로 좁아진다) 칸 글자는 1번 글꼴(맑은 고딕)로 따로 준다
   */
  fonts = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>', `<font><sz val="${DEFAULT_PT}"/><name val="${EXCEL_FONT}"/><family val="2"/></font>`];
  fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  numFmts: string[] = [];
  // 0: 표준(빈 칸) / 1: 서식 없는 칸 — 글꼴만 맑은 고딕
  xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>', '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'];
  private index = new Map<string, number>();

  private add(list: string[], xml: string): number {
    const i = list.indexOf(xml);
    if (i >= 0) return i;
    list.push(xml);
    return list.length - 1;
  }

  /** 칸 하나의 서식 번호(s=) — 아무 서식 없으면 1(맑은 고딕만) */
  xf(style: CellStyle | undefined, fmt: string | undefined, fit: Fit): number {
    const key = JSON.stringify([style ?? null, fmt ?? null, fit]);
    const hit = this.index.get(key);
    if (!fmt && !fit && (!style || Object.keys(style).length === 0)) return 1;
    const wrap = fit === 'wrap';
    const shrink = fit === 'shrink' || (!!style?.shrink && !wrap);
    if (hit !== undefined) return hit;
    const s = style ?? {};
    // 글꼴
    const color = argb(s.color);
    const fontXml =
      '<font>' +
      (s.bold ? '<b/>' : '') +
      (s.italic ? '<i/>' : '') +
      (s.underline ? '<u/>' : '') +
      `<sz val="${s.fontSize ?? DEFAULT_PT}"/>` +
      (color ? `<color rgb="${color}"/>` : '') +
      `<name val="${EXCEL_FONT}"/><family val="2"/></font>`;
    const fontId = this.add(this.fonts, fontXml);
    // 채우기
    const bg = argb(s.bg);
    const fillId = bg ? this.add(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="${bg}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    // 테두리
    const side = (tag: string, w: string | undefined) =>
      w && w !== 'none' ? `<${tag} style="${w === 'thick' ? 'medium' : 'thin'}"><color rgb="FF000000"/></${tag}>` : `<${tag}/>`;
    const b = s.border;
    const borderId = b ? this.add(this.borders, `<border>${side('left', b.l)}${side('right', b.r)}${side('top', b.t)}${side('bottom', b.b)}<diagonal/></border>`) : 0;
    // 숫자 표시
    let numFmtId = 0;
    if (fmt) {
      const i = this.numFmts.indexOf(fmt);
      numFmtId = 164 + (i >= 0 ? i : this.numFmts.push(fmt) - 1);
    }
    // 정렬
    const h = s.align;
    const v = s.valign === 'middle' ? 'center' : s.valign;
    const align = h || v || wrap || shrink ? `<alignment${h ? ` horizontal="${h}"` : ''}${v ? ` vertical="${v}"` : ' vertical="center"'}${wrap ? ' wrapText="1"' : ''}${shrink ? ' shrinkToFit="1"' : ''}/>` : '';
    const xml =
      `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"` +
      (numFmtId ? ' applyNumberFormat="1"' : '') +
      (fontId ? ' applyFont="1"' : '') +
      (fillId ? ' applyFill="1"' : '') +
      (borderId ? ' applyBorder="1"' : '') +
      (align ? ` applyAlignment="1">${align}</xf>` : '/>');
    this.xfs.push(xml);
    const id = this.xfs.length - 1;
    this.index.set(key, id);
    return id;
  }

  toXml(): string {
    const fmts = this.numFmts.length
      ? `<numFmts count="${this.numFmts.length}">${this.numFmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(f)}"/>`).join('')}</numFmts>`
      : '';
    return (
      XML_HEAD +
      `<styleSheet xmlns="${NS_MAIN}">${fmts}` +
      `<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.join('')}</fills>` +
      `<borders count="${this.borders.length}">${this.borders.join('')}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>'
    );
  }
}

/** 시트 → 엑셀 파일 바이트(.xlsx) */
export async function exportXlsx(s: Sheet, opts: XlsxExportOptions = {}): Promise<Uint8Array> {
  const book = new StyleBook();
  const keepRows: number[] = [];
  for (let r = 0; r < s.rows.length; r++) if (!opts.skipRow?.(r)) keepRows.push(r);
  const newRow = new Map(keepRows.map((r, i) => [r, i]));
  const withFormulas = !!opts.formulas && keepRows.length === s.rows.length;

  // 병합 — 뺀 행을 건너 줄인다(병합 첫 행이 빠지면 남은 첫 행부터)
  const merges: string[] = [];
  for (const m of s.merges) {
    const rows = keepRows.filter((r) => r >= m.startRow && r < m.startRow + m.rowSpan);
    if (!rows.length || (rows.length === 1 && m.colSpan === 1)) continue;
    const r1 = newRow.get(rows[0])!;
    const r2 = newRow.get(rows[rows.length - 1])!;
    merges.push(`<mergeCell ref="${colLetter(m.startCol)}${r1 + 1}:${colLetter(m.startCol + m.colSpan - 1)}${r2 + 1}"/>`);
  }
  // 병합에 가려진 칸 — 값은 비우되 테두리는 남긴다(엑셀은 병합 바깥선을 가려진 칸의 테두리로 그린다).
  // 병합의 첫 행이 빠지면(조건으로 숨은 행 등) 남은 첫 행이 대표 칸 — 원래 첫 칸의 값·서식을 그 자리에 쓴다(화면과 같게)
  const covered = new Set<string>();
  /** 대표 칸이 옮겨 온 자리 'r:c' → 원래 첫 행 */
  const movedFrom = new Map<string, number>();
  /** 원래 첫 행(빠진 행)의 대표 칸 'r:c' → 옮겨 간 행 — 그 칸에 놓을 그림도 옮긴다 */
  const movedTo = new Map<string, number>();
  for (const m of s.merges) {
    const first = keepRows.find((r) => r >= m.startRow && r < m.startRow + m.rowSpan);
    const anchorRow = first !== undefined && first !== m.startRow ? first : m.startRow;
    if (anchorRow !== m.startRow) {
      movedFrom.set(`${anchorRow}:${m.startCol}`, m.startRow);
      movedTo.set(`${m.startRow}:${m.startCol}`, anchorRow);
    }
    for (let r = m.startRow; r < m.startRow + m.rowSpan; r++)
      for (let c = m.startCol; c < m.startCol + m.colSpan; c++) if (r !== anchorRow || c !== m.startCol) covered.add(`${r}:${c}`);
  }

  // 줄 높이·칸 크기 — 칸보다 긴 글을 엑셀에서 어떻게 보일지 정한다(화면은 칸 안에서 줄을 바꾸거나 글씨를 줄인다)
  const heightOf = (r: number) => opts.rowHeight?.(r) ?? s.rowHeights[String(r)] ?? DEFAULT_ROW_HEIGHT;
  const mergeOf = (r: number, c: number) => s.merges.find((m) => m.startRow === r && m.startCol === c);
  /** r 은 원래 첫 행(병합 크기를 찾는 기준) */
  const fitOf = (r: number, c: number, text: string, style: CellStyle | undefined): Fit => {
    if (!text) return null;
    if (text.includes('\n')) return 'wrap';
    const m = mergeOf(r, c);
    let w = 0;
    for (let k = c; k < c + (m?.colSpan ?? 1); k++) w += s.colWidths[s.cols[k]] ?? DEFAULT_COL_WIDTH;
    let h = 0;
    for (let k = r; k < r + (m?.rowSpan ?? 1); k++) if (newRow.has(k)) h += heightOf(k);
    const px = ((style?.fontSize ?? DEFAULT_PT) * 4) / 3;
    const tw = textWidth(text, px, !!style?.bold, EXCEL_FONT_CSS);
    if (tw === null || tw <= w - EXCEL_CELL_PAD) return null;
    // 두 줄 이상 들어갈 높이면 줄바꿈(화면처럼), 아니면 칸에 맞춰 줄인다(잘려 보이지 않게)
    return h >= px * 1.25 * 2 ? 'wrap' : 'shrink';
  };

  const rowXml: string[] = [];
  keepRows.forEach((r, i) => {
    const cells: string[] = [];
    s.cols.forEach((col, c) => {
      const ref = `${colLetter(c)}${i + 1}`;
      if (covered.has(`${r}:${c}`)) {
        const style = s.styles[cellKey(r, col)];
        // 가려진 칸 — 테두리·배경만(값 없음)
        if (style?.border || style?.bg) cells.push(`<c r="${ref}" s="${book.xf({ border: style.border, bg: style.bg }, undefined, null)}"/>`);
        return;
      }
      // 옮겨 온 대표 칸이면 원래 첫 행의 값·서식으로
      const src = movedFrom.get(`${r}:${c}`) ?? r;
      const key = cellKey(src, col);
      const style = s.styles[key];
      const text = opts.cellText?.(src, c) ?? String(s.rows[src]?.[col] ?? '');
      const formula = withFormulas ? s.formulas[key] : undefined;
      const n = asNumber(text);
      const xf = book.xf(style, numFmtCode(style, n), n === null ? fitOf(src, c, text, style) : null);
      const sAttr = xf ? ` s="${xf}"` : '';
      if (formula) {
        const f = `<f>${esc(formula.replace(/^=/, ''))}</f>`;
        cells.push(n !== null ? `<c r="${ref}"${sAttr}>${f}<v>${n}</v></c>` : `<c r="${ref}"${sAttr} t="str">${f}<v>${esc(text)}</v></c>`);
      } else if (text === '') {
        if (xf > 1) cells.push(`<c r="${ref}"${sAttr}/>`);
      } else if (n !== null) {
        cells.push(`<c r="${ref}"${sAttr}><v>${n}</v></c>`);
      } else {
        cells.push(`<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`);
      }
    });
    const ht = ` ht="${Math.round(heightOf(r) * 0.75 * 10) / 10}" customHeight="1"`;
    rowXml.push(`<row r="${i + 1}"${ht}>${cells.join('')}</row>`);
  });

  // 열 너비 — 픽셀 → 엑셀 글자 수(불러오기 charsToPx 의 반대)
  const colXml = s.cols
    .map((col, c) => {
      const px = s.colWidths[col] ?? DEFAULT_COL_WIDTH;
      const w = Math.max(1, Math.round(((px - 5) / 7) * 100) / 100);
      return `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`;
    })
    .join('');

  // 그림 — 칸 기준 자리를 실제 칸(남긴 행 기준)으로 옮겨 놓는다
  const colW = s.cols.map((col) => s.colWidths[col] ?? DEFAULT_COL_WIDTH);
  const rowH = keepRows.map((r) => heightOf(r));
  const pics = (opts.pictures ?? [])
    .map((p) => (newRow.has(p.r) ? p : { ...p, r: movedTo.get(`${p.r}:${p.c}`) ?? p.r }))
    .filter((p) => newRow.has(p.r) && p.c >= 0 && p.c < s.cols.length && p.width > 0 && p.height > 0);
  // 자리(시트 px) → 칸 번호 + 칸 안 거리. 음수나 칸보다 큰 값은 옆·위·아래 칸으로 넘긴다
  const locate = (c0: number, x0: number, r0: number, y0: number) => {
    let col = c0;
    let x = x0;
    while (x < 0 && col > 0) x += colW[--col];
    while (col < colW.length - 1 && x >= colW[col]) x -= colW[col++];
    let row = r0;
    let y = y0;
    while (y < 0 && row > 0) y += rowH[--row];
    while (row < rowH.length - 1 && y >= rowH[row]) y -= rowH[row++];
    return `<xdr:col>${col}</xdr:col><xdr:colOff>${Math.max(0, Math.round(x * EMU))}</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>${Math.max(0, Math.round(y * EMU))}</xdr:rowOff>`;
  };
  /*
    그림은 네 모서리 중 왼쪽 위·오른쪽 아래를 칸에 묶는다(twoCellAnchor) — 엑셀은 열 너비를 '글자 수'로 저장하고 그 컴퓨터의
    화면 배율로 픽셀을 정하므로, 그림을 절대 크기로만 두면 열이 넓게 그려지는 컴퓨터에서 오른쪽 그림일수록 왼쪽으로 밀려 보인다.
    칸에 묶으면 어디서 열어도 같은 칸 자리에 놓인다(열 너비를 바꿔도 함께 움직이고, 크기는 그대로 — editAs oneCell)
  */
  const anchors = pics.map((p, i) => {
    const row = newRow.get(p.r)!;
    const cx = Math.round(p.width * EMU);
    const cy = Math.round(p.height * EMU);
    return (
      '<xdr:twoCellAnchor editAs="oneCell">' +
      `<xdr:from>${locate(p.c, p.x, row, p.y)}</xdr:from>` +
      `<xdr:to>${locate(p.c, p.x + p.width, row, p.y + p.height)}</xdr:to>` +
      `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 2}" name="그림 ${i + 1}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
      `<xdr:blipFill><a:blip r:embed="rId${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
      `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>` +
      '<xdr:clientData/></xdr:twoCellAnchor>'
    );
  });
  const hasPics = pics.length > 0;

  const lastRef = `${colLetter(Math.max(0, s.cols.length - 1))}${Math.max(1, keepRows.length)}`;
  const sheetXml =
    XML_HEAD +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    // 인쇄 — 폭을 종이 한 장에 맞춤(아래로는 여러 장). fitToPage 를 켜야 pageSetup 의 fitToWidth 가 먹는다
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<dimension ref="A1:${lastRef}"/>` +
    '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>' +
    `<sheetFormatPr defaultRowHeight="${Math.round(DEFAULT_ROW_HEIGHT * 0.75 * 10) / 10}"/>` +
    (colXml ? `<cols>${colXml}</cols>` : '') +
    `<sheetData>${rowXml.join('')}</sheetData>` +
    (merges.length ? `<mergeCells count="${merges.length}">${merges.join('')}</mergeCells>` : '') +
    '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>' +
    (hasPics ? '<drawing r:id="rId1"/>' : '') +
    '</worksheet>';

  const name = safeSheetName(opts.sheetName);

  const files: [string, string | Uint8Array][] = [
    [
      '[Content_Types].xml',
      XML_HEAD +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        (hasPics ? '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>' : '') +
        (hasPics ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : '') +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    ],
    [
      '_rels/.rels',
      XML_HEAD +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ],
    [
      'xl/workbook.xml',
      XML_HEAD +
        `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
        `<sheets><sheet name="${esc(name)}" sheetId="1" r:id="rId1"/></sheets>` +
        (withFormulas ? '<calcPr calcId="191029" fullCalcOnLoad="1"/>' : '') +
        '</workbook>',
    ],
    [
      'xl/_rels/workbook.xml.rels',
      XML_HEAD +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>',
    ],
    ['xl/worksheets/sheet1.xml', sheetXml],
    ['xl/styles.xml', book.toXml()],
  ];
  if (hasPics) {
    files.push(
      [
        'xl/worksheets/_rels/sheet1.xml.rels',
        XML_HEAD +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>' +
          '</Relationships>',
      ],
      [
        'xl/drawings/drawing1.xml',
        XML_HEAD +
          '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="' +
          NS_REL +
          '">' +
          anchors.join('') +
          '</xdr:wsDr>',
      ],
      [
        'xl/drawings/_rels/drawing1.xml.rels',
        XML_HEAD +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          pics.map((p, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i + 1}.${p.type}"/>`).join('') +
          '</Relationships>',
      ],
      ...pics.map((p, i): [string, Uint8Array] => [`xl/media/image${i + 1}.${p.type}`, p.data])
    );
  }
  return zip(files);
}

/** 브라우저에서 엑셀 파일로 받기 */
export function downloadXlsx(bytes: Uint8Array, fileName: string): void {
  const name = /\.xlsx$/i.test(fileName) ? fileName : `${fileName}.xlsx`;
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]/g, '_');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
