/**
 * 문단 간격·표 테두리 — 문서 JSON 값 ↔ 화면 CSS ↔ 워드 값 변환(편집기·저장·불러오기가 같은 규칙을 쓴다).
 *
 * 문단(paragraph·heading) attrs
 * - lineHeight: 줄 간격(워드 배수 — 1 = 한 줄, 1.15, 1.5, 2 …). 화면은 배수 × WORD_SINGLE_LINE
 * - spaceBefore·spaceAfter: 문단 앞·뒤 간격(pt)
 * - indent: 왼쪽 들여쓰기(pt), firstLine: 첫 줄 들여쓰기(pt, 음수면 내어쓰기)
 *
 * 표 열 너비 맞추기(fitWidths — 열을 넣어도 표 너비 그대로), 끌어 바꿀 때 본문 경계에 붙이기(snapColumnWidth).
 * 표 칸(tableCell·tableHeader) attrs.borders: { top, right, bottom, left } 마다 { style, width(px, 소수 — 워드 0.5pt 선은 0.67px), color('#rrggbb') }
 */

/** 워드 '한 줄' 간격이 글자 크기의 몇 배인지(맑은 고딕 기준) — 화면 줄 높이 = 워드 배수 × 이 값 */
export const WORD_SINGLE_LINE = 1.3;
/** 편집기 기본 문단 모양(값이 없을 때) — 화면 CSS·저장 기본값과 같다. 표 칸 안은 문단 간격 0 */
export const PARA_DEFAULT = { lineHeight: 1.15, spaceBefore: 0, spaceAfter: 6 } as const;
export const PARA_DEFAULT_IN_CELL = { lineHeight: 1.15, spaceBefore: 0, spaceAfter: 0 } as const;
/** 제목 기본 모양 — 한 줄 간격, 제목 1·2 는 앞 18pt, 나머지 12pt, 뒤 6pt(화면 CSS·저장 스타일과 같다) */
export function headingDefault(level: number): { lineHeight: number; spaceBefore: number; spaceAfter: number } {
  return { lineHeight: 1, spaceBefore: level <= 2 ? 18 : 12, spaceAfter: 6 };
}

/** 그 자리 문단의 기본 모양 — 제목·본문, 표 칸 안·밖에 따라 다르다(칸 안은 앞뒤 간격 0) */
export function paraDefault(heading: number | undefined, inCell: boolean): { lineHeight: number; spaceBefore: number; spaceAfter: number } {
  if (heading) return inCell ? { lineHeight: 1, spaceBefore: 0, spaceAfter: 0 } : headingDefault(heading);
  return inCell ? PARA_DEFAULT_IN_CELL : PARA_DEFAULT;
}

export interface ParaFormat {
  lineHeight?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  indent?: number;
  firstLine?: number;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** 문단 attrs → 화면 style 글(값이 있는 것만) */
export function paraCss(a: Record<string, unknown>): string {
  const out: string[] = [];
  const lh = num(a.lineHeight);
  if (lh) out.push(`line-height:${+(lh * WORD_SINGLE_LINE).toFixed(3)}`);
  const sb = num(a.spaceBefore);
  if (sb !== undefined) out.push(`margin-top:${sb}pt`);
  const sa = num(a.spaceAfter);
  if (sa !== undefined) out.push(`margin-bottom:${sa}pt`);
  const ind = num(a.indent);
  if (ind) out.push(`margin-left:${ind}pt`);
  const fl = num(a.firstLine);
  if (fl) out.push(`text-indent:${fl}pt`);
  return out.join(';');
}

/** 문단 attrs → 워드 pPr 의 spacing·ind (pPr 순서상 spacing → ind). tight: 값이 없으면 앞뒤 간격 0(표 칸) */
export function paraXml(a: Record<string, unknown> | undefined, opts: { tight?: boolean; skipIndent?: boolean } = {}): { spacing: string; ind: string } {
  const sb = num(a?.spaceBefore) ?? (opts.tight ? 0 : undefined);
  const sa = num(a?.spaceAfter) ?? (opts.tight ? 0 : undefined);
  const lh = num(a?.lineHeight);
  const sp: string[] = [];
  if (sb !== undefined) sp.push(`w:before="${Math.round(sb * 20)}"`);
  if (sa !== undefined) sp.push(`w:after="${Math.round(sa * 20)}"`);
  if (lh) sp.push(`w:line="${Math.round(lh * 240)}" w:lineRule="auto"`);
  const ind: string[] = [];
  const left = opts.skipIndent ? undefined : num(a?.indent);
  const fl = opts.skipIndent ? undefined : num(a?.firstLine);
  if (left) ind.push(`w:left="${Math.round(left * 20)}"`);
  if (fl) ind.push(fl > 0 ? `w:firstLine="${Math.round(fl * 20)}"` : `w:hanging="${Math.round(-fl * 20)}"`);
  return { spacing: sp.length ? `<w:spacing ${sp.join(' ')}/>` : '', ind: ind.length ? `<w:ind ${ind.join(' ')}/>` : '' };
}

// ── 표 열 너비 ──

/** 칸 최소 너비(px) — 편집기가 이보다 좁게 그리지 않는다 */
export const CELL_MIN_WIDTH = 40;

/** 열 너비들을 합이 total 이 되게 비율로 — 최소 너비보다 좁아지는 열은 최소 너비로 두고 나머지를 더 줄인다(넘치면 가로 스크롤이 생기므로) */
export function fitWidths(widths: number[], total: number): number[] {
  const fixed = new Set<number>();
  for (;;) {
    const rest = total - fixed.size * CELL_MIN_WIDTH;
    const free = widths.reduce((a, w, i) => (fixed.has(i) ? a : a + w), 0);
    const k = free > 0 ? rest / free : 0;
    const out = widths.map((w, i) => (fixed.has(i) ? CELL_MIN_WIDTH : Math.floor(w * k)));
    const narrow = out.findIndex((w, i) => !fixed.has(i) && w < CELL_MIN_WIDTH);
    if (narrow < 0 || fixed.size + 1 >= widths.length) return out.map((w) => Math.max(CELL_MIN_WIDTH, w));
    fixed.add(narrow);
  }
}

/** 표 오른쪽 끝이 본문 경계 앞뒤로 이만큼(px) 안에 오면 경계에 붙인다 */
export const TABLE_SNAP = 12;

/**
 * 열 너비를 끌어 바꿀 때 — 표 오른쪽 끝이 본문 경계(limit) 앞뒤 근처면 경계에 붙인다(워드처럼). 더 끌면 경계를 넘어간다.
 * 너비를 정하지 않은 열이 있으면 그대로
 */
export function snapColumnWidth(widths: (number | undefined)[], col: number, width: number, limit: number): number {
  if (widths.some((w, i) => i !== col && w === undefined)) return width;
  const others = widths.reduce<number>((sum, w, i) => (i === col ? sum : sum + (w ?? 0)), 0);
  const snapped = limit - others;
  return snapped >= CELL_MIN_WIDTH && Math.abs(others + width - limit) <= TABLE_SNAP ? snapped : width;
}

// ── 표 테두리 ──

export type BorderStyle = 'solid' | 'double' | 'dashed' | 'dotted' | 'none';
export interface CellBorder {
  style: BorderStyle;
  /** px(소수 그대로 — 반올림하면 저장·불러오기를 오갈 때 선 굵기가 바뀐다) */
  width: number;
  color: string;
}
export type BorderSide = 'top' | 'right' | 'bottom' | 'left';
export type CellBorders = Partial<Record<BorderSide, CellBorder>>;
export const BORDER_SIDES: BorderSide[] = ['top', 'right', 'bottom', 'left'];

/** 칸 테두리 attrs → 화면 style 글 */
export function bordersCss(b: unknown): string {
  if (!b || typeof b !== 'object') return '';
  return BORDER_SIDES.map((side) => {
    const s = (b as CellBorders)[side];
    if (!s) return '';
    if (s.style === 'none') return `border-${side}:none`;
    // 화면은 1px 보다 가늘게 못 그린다. 이중선은 3px 이상이어야 두 줄로 보인다
    const w = s.style === 'double' ? Math.max(3, s.width) : Math.max(1, Math.round(s.width));
    return `border-${side}:${w}px ${s.style} ${s.color}`;
  })
    .filter(Boolean)
    .join(';');
}

const FROM_WORD: Record<string, BorderStyle> = {
  nil: 'none', none: 'none', single: 'solid', thick: 'solid', double: 'double',
  dashed: 'dashed', dashSmallGap: 'dashed', dotDash: 'dashed', dotDotDash: 'dashed', dotted: 'dotted',
};

/** 워드 테두리(w:val·w:sz(1/8pt)·w:color) → 칸 테두리 */
export function borderFromWord(attrs: Record<string, string | undefined>): CellBorder {
  const v = attrs.val ?? 'single';
  const style = FROM_WORD[v] ?? 'solid';
  const pt = (Number(attrs.sz) || 4) / 8;
  const width = style === 'none' ? 0 : Math.round(((pt * 4) / 3) * 100) / 100;
  const c = attrs.color;
  const color = c && /^[0-9a-f]{6}$/i.test(c) ? `#${c.toLowerCase()}` : '#000000';
  return { style, width, color };
}

const TO_WORD: Record<BorderStyle, string> = { none: 'nil', solid: 'single', double: 'double', dashed: 'dashed', dotted: 'dotted' };

/** 칸 테두리 → 워드 tcBorders(순서 top → left → bottom → right). 테두리를 정하지 않은 칸은 빈 글 */
export function bordersXml(b: unknown): string {
  if (!b || typeof b !== 'object') return '';
  const side = (tag: string, s: CellBorder | undefined) => {
    if (!s) return '';
    if (s.style === 'none') return `<w:${tag} w:val="nil"/>`;
    const sz = Math.min(96, Math.max(2, Math.round(s.width * 0.75 * 8)));
    const color = /^#[0-9a-f]{6}$/i.test(s.color) ? s.color.slice(1).toUpperCase() : 'auto';
    return `<w:${tag} w:val="${TO_WORD[s.style]}" w:sz="${sz}" w:space="0" w:color="${color}"/>`;
  };
  const bb = b as CellBorders;
  const inner = side('top', bb.top) + side('left', bb.left) + side('bottom', bb.bottom) + side('right', bb.right);
  return inner ? `<w:tcBorders>${inner}</w:tcBorders>` : '';
}

/** 네 변 모두 같은 테두리 */
export function allSides(b: CellBorder): CellBorders {
  return { top: b, right: b, bottom: b, left: b };
}
