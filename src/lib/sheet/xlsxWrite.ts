/**
 * 엑셀(.xlsx) 내보내기 — 외부 라이브러리 없이 시트를 엑셀 파일로 만든다(불러오기 xlsx.ts 의 반대).
 * 담는 것: 값(숫자는 숫자로), 수식(계산된 값과 함께, 고를 때만), 병합, 열 너비·행 높이,
 *          글자(굵게·기울임·밑줄·크기·색), 배경색, 정렬, 숫자 표시(금액·백분율), 테두리, 줄바꿈.
 * 시트 한 장 = 엑셀 시트 한 장. 문자열은 칸 안에 바로 넣는다(inlineStr — 공유 문자열 표 없이).
 */
import { colLetter, parseNumber } from './formula';
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, cellKey, type CellStyle, type Sheet } from './model';
import { zip } from './zip';

export interface XlsxExportOptions {
  /** 엑셀 아래 시트 탭 이름(31자까지, 엑셀이 못 쓰는 글자는 뺌) */
  sheetName?: string;
  /** 빼고 내보낼 행(숨은 행·조건으로 숨긴 행 등). 빼면 아래 행이 올라오므로 수식은 값으로만 담는다 */
  skipRow?: (r: number) => boolean;
  /** 칸 글자를 바꿔 담기(예: 비공개 칸은 '비공개', 자동 채우기 칸은 그 값). undefined 면 시트 값 그대로 */
  cellText?: (r: number, c: number) => string | undefined;
  /** 수식도 담기(기본 false — 계산된 값만). 행을 빼면 무시하고 값만 */
  formulas?: boolean;
}

/** 엑셀 기본 글자 크기(pt) — 화면 기본(12px = 9pt)보다 조금 크게, 엑셀에서 읽기 좋게 */
const DEFAULT_PT = 10;
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** XML 글자 — 특수 문자를 바꾸고 XML 에 못 넣는 제어 문자는 뺀다 */
function esc(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
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
  const n = (name ?? '').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31);
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
  fonts = [`<font><sz val="${DEFAULT_PT}"/><name val="맑은 고딕"/><family val="2"/></font>`];
  fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  numFmts: string[] = [];
  xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  private index = new Map<string, number>();

  private add(list: string[], xml: string): number {
    const i = list.indexOf(xml);
    if (i >= 0) return i;
    list.push(xml);
    return list.length - 1;
  }

  /** 칸 하나의 서식 번호(s=) — 아무 서식 없으면 0 */
  xf(style: CellStyle | undefined, fmt: string | undefined, wrap: boolean): number {
    const key = JSON.stringify([style ?? null, fmt ?? null, wrap]);
    const hit = this.index.get(key);
    if (!fmt && !wrap && (!style || Object.keys(style).length === 0)) return 0;
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
      '<name val="맑은 고딕"/><family val="2"/></font>';
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
    const align = h || v || wrap || s.shrink ? `<alignment${h ? ` horizontal="${h}"` : ''}${v ? ` vertical="${v}"` : ' vertical="center"'}${wrap ? ' wrapText="1"' : ''}${s.shrink ? ' shrinkToFit="1"' : ''}/>` : '';
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
  // 병합에 가려진 칸 — 값은 비우되 테두리는 남긴다(엑셀은 병합 바깥선을 가려진 칸의 테두리로 그린다)
  const covered = new Set<string>();
  for (const m of s.merges)
    for (let r = m.startRow; r < m.startRow + m.rowSpan; r++)
      for (let c = m.startCol; c < m.startCol + m.colSpan; c++) if (r !== m.startRow || c !== m.startCol) covered.add(`${r}:${c}`);

  const rowXml: string[] = [];
  keepRows.forEach((r, i) => {
    const cells: string[] = [];
    s.cols.forEach((col, c) => {
      const key = cellKey(r, col);
      const style = s.styles[key];
      const ref = `${colLetter(c)}${i + 1}`;
      if (covered.has(`${r}:${c}`)) {
        if (style?.border || style?.bg) cells.push(`<c r="${ref}" s="${book.xf({ border: style.border, bg: style.bg }, undefined, false)}"/>`);
        return;
      }
      const text = opts.cellText?.(r, c) ?? String(s.rows[r]?.[col] ?? '');
      const formula = withFormulas ? s.formulas[key] : undefined;
      const n = asNumber(text);
      const wrap = text.includes('\n');
      const xf = book.xf(style, numFmtCode(style, n), wrap);
      const sAttr = xf ? ` s="${xf}"` : '';
      if (formula) {
        const f = `<f>${esc(formula.replace(/^=/, ''))}</f>`;
        cells.push(n !== null ? `<c r="${ref}"${sAttr}>${f}<v>${n}</v></c>` : `<c r="${ref}"${sAttr} t="str">${f}<v>${esc(text)}</v></c>`);
      } else if (text === '') {
        if (xf) cells.push(`<c r="${ref}"${sAttr}/>`);
      } else if (n !== null) {
        cells.push(`<c r="${ref}"${sAttr}><v>${n}</v></c>`);
      } else {
        cells.push(`<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`);
      }
    });
    const h = s.rowHeights[String(r)];
    const ht = h && h !== DEFAULT_ROW_HEIGHT ? ` ht="${Math.round(h * 0.75 * 10) / 10}" customHeight="1"` : ` ht="${Math.round(DEFAULT_ROW_HEIGHT * 0.75 * 10) / 10}" customHeight="1"`;
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

  const lastRef = `${colLetter(Math.max(0, s.cols.length - 1))}${Math.max(1, keepRows.length)}`;
  const sheetXml =
    XML_HEAD +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<dimension ref="A1:${lastRef}"/>` +
    '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>' +
    `<sheetFormatPr defaultRowHeight="${Math.round(DEFAULT_ROW_HEIGHT * 0.75 * 10) / 10}"/>` +
    (colXml ? `<cols>${colXml}</cols>` : '') +
    `<sheetData>${rowXml.join('')}</sheetData>` +
    (merges.length ? `<mergeCells count="${merges.length}">${merges.join('')}</mergeCells>` : '') +
    '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>' +
    '</worksheet>';

  const name = safeSheetName(opts.sheetName);
  const files: [string, string][] = [
    [
      '[Content_Types].xml',
      XML_HEAD +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
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
