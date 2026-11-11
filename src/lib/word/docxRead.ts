/**
 * 워드(.docx) 불러오기 — 외부 라이브러리 없이 .docx 를 문서 JSON(model.ts)으로 읽는다.
 * 읽는 것: 문단·제목(스타일 이름·개요 수준)·정렬·줄 간격·문단 앞뒤 간격·들여쓰기(문서 기본값·스타일 반영), 글자(굵게·기울임·밑줄·취소선·크기·색·글꼴·형광펜·음영), 링크, 줄바꿈·탭,
 *          글머리·번호 목록(여러 단계), 표(가로·세로 합친 칸·열 너비·행 높이·칸 배경색·세로 맞춤·테두리), 그림(PNG·JPEG·GIF).
 * 읽지 않는 것: 머리글·바닥글, 각주, 메모, 변경 내용 추적, 글상자·도형, 쪽 나누기·단(본문 흐름만 읽는다)
 */
import { A4_CONTENT_WIDTH, TABLE_MAX_WIDTH, emptyWordDoc, type WordMark, type WordNode } from './model';
import { sniffImage, toDataUrl } from './image';
import { BORDER_SIDES, WORD_SINGLE_LINE, paraDefault, borderFromWord, type CellBorders, type ParaFormat } from './format';
import { child, children, find, parseXml, type XmlNode } from './xml';
import { unzip } from './zip';

export class DocxError extends Error {}

export interface DocxImport {
  doc: WordNode;
  /** 사람이 읽을 안내 — 못 읽은 것 */
  warnings: string[];
}

const TWIP = 15;
const EMU = 9525;
/** 워드 형광펜 이름 → 색 */
const HIGHLIGHT: Record<string, string> = {
  yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000',
  darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000',
  darkYellow: '#808000', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000', white: '#ffffff',
};

interface StyleInfo {
  name: string;
  basedOn?: string;
  outline?: number;
  numId?: string;
  ilvl?: number;
  /** 문단 스타일의 문단 모양(간격·들여쓰기) */
  pPr?: XmlNode;
  /** 표 스타일의 테두리 */
  tblBorders?: XmlNode;
}

interface Ctx {
  styles: Map<string, StyleInfo>;
  /** numId → 단계 → { 글머리인가, 시작 번호 } */
  numbering: Map<string, Map<number, { bullet: boolean; start: number }>>;
  rels: Map<string, string>;
  files: Map<string, Uint8Array>;
  warnings: Set<string>;
  /** 본문 파일이 든 폴더('word/') — 그림 경로 기준 */
  dir: string;
  /** 문서 기본 문단 모양(docDefaults)과 기본 문단 스타일 */
  defaultPPr?: XmlNode;
  defaultParaStyle?: string;
  defaultTableStyle?: string;
  /** 표 칸 안을 읽는 중(겹친 표 깊이) — 칸 안 문단은 기본 간격이 다르다 */
  inCell: number;
}

const dec = new TextDecoder();
const read = (files: Map<string, Uint8Array>, path: string) => {
  const b = files.get(path);
  return b ? parseXml(dec.decode(b)) : undefined;
};
const val = (n: XmlNode | undefined) => n?.attrs.val;
/** 켜짐/꺼짐 속성(<w:b/>, <w:b w:val="0"/>) */
const on = (n: XmlNode | undefined) => !!n && !['0', 'false', 'off', 'none'].includes(String(n.attrs.val ?? '').toLowerCase());

/** styles 요소 → 스타일 id 별 정보 */
function readStyles(stylesEl: XmlNode | undefined): Map<string, StyleInfo> {
  const out = new Map<string, StyleInfo>();
  for (const s of children(stylesEl, 'style')) {
    const id = s.attrs.styleId;
    if (!id) continue;
    const pPr = child(s, 'pPr');
    const outline = val(child(pPr, 'outlineLvl'));
    const numPr = child(pPr, 'numPr');
    out.set(id, {
      name: (val(child(s, 'name')) ?? id).toLowerCase(),
      basedOn: val(child(s, 'basedOn')),
      outline: outline !== undefined ? Number(outline) : undefined,
      numId: val(child(numPr, 'numId')),
      ilvl: val(child(numPr, 'ilvl')) !== undefined ? Number(val(child(numPr, 'ilvl'))) : undefined,
      pPr,
      tblBorders: child(child(s, 'tblPr'), 'tblBorders'),
    });
  }
  return out;
}

function readNumbering(root: XmlNode | undefined): Ctx['numbering'] {
  const numbering = find(root, 'numbering');
  const abstracts = new Map<string, Map<number, { bullet: boolean; start: number }>>();
  for (const a of children(numbering, 'abstractNum')) {
    const lv = new Map<number, { bullet: boolean; start: number }>();
    for (const l of children(a, 'lvl')) {
      lv.set(Number(l.attrs.ilvl ?? 0), { bullet: val(child(l, 'numFmt')) === 'bullet', start: Number(val(child(l, 'start')) ?? 1) || 1 });
    }
    abstracts.set(a.attrs.abstractNumId ?? '', lv);
  }
  const out: Ctx['numbering'] = new Map();
  for (const n of children(numbering, 'num')) {
    const base = abstracts.get(val(child(n, 'abstractNumId')) ?? '') ?? new Map();
    const lv = new Map(base);
    for (const o of children(n, 'lvlOverride')) {
      const s = val(child(o, 'startOverride'));
      const i = Number(o.attrs.ilvl ?? 0);
      if (s !== undefined && lv.has(i)) lv.set(i, { ...lv.get(i)!, start: Number(s) || 1 });
    }
    out.set(n.attrs.numId ?? '', lv);
  }
  return out;
}

/** 스타일과 그 바탕 스타일을 따라가며 첫 값 */
function styleChain<T>(ctx: Ctx, id: string | undefined, pick: (s: StyleInfo) => T | undefined): T | undefined {
  for (let k = 0, cur = id; cur && k < 10; k++) {
    const s = ctx.styles.get(cur);
    if (!s) return undefined;
    const v = pick(s);
    if (v !== undefined) return v;
    cur = s.basedOn;
  }
  return undefined;
}

/** 제목 단계(1~6) — 스타일 이름(heading 1·제목 1)이나 개요 수준 */
function headingLevel(ctx: Ctx, pPr: XmlNode | undefined): number | undefined {
  const own = val(child(pPr, 'outlineLvl'));
  if (own !== undefined && Number(own) < 9) return Math.min(6, Number(own) + 1);
  const id = val(child(pPr, 'pStyle'));
  const name = styleChain(ctx, id, (s) => (/^(heading|제목)\s*\d$/.test(s.name) ? s.name : undefined));
  if (name) return Math.min(6, Number(name.replace(/\D/g, '')) || 1);
  if (styleChain(ctx, id, (s) => (s.name === 'title' ? 'title' : undefined))) return 1;
  const outline = styleChain(ctx, id, (s) => s.outline);
  return outline !== undefined && outline < 9 ? Math.min(6, outline + 1) : undefined;
}

// ── 글(run) ──

function runMarks(rPr: XmlNode | undefined, link?: string): WordMark[] {
  const marks: WordMark[] = [];
  if (on(child(rPr, 'b'))) marks.push({ type: 'bold' });
  if (on(child(rPr, 'i'))) marks.push({ type: 'italic' });
  const u = child(rPr, 'u');
  if (u && on(u)) marks.push({ type: 'underline' });
  if (on(child(rPr, 'strike')) || on(child(rPr, 'dstrike'))) marks.push({ type: 'strike' });
  const style: Record<string, string> = {};
  const color = val(child(rPr, 'color'));
  if (color && /^[0-9a-f]{6}$/i.test(color) && !(link && color.toUpperCase() === '0563C1')) style.color = `#${color.toLowerCase()}`;
  const sz = Number(val(child(rPr, 'sz')));
  if (sz > 0) style.fontSize = `${sz / 2}pt`;
  const font = child(rPr, 'rFonts');
  const family = font?.attrs.eastAsia ?? font?.attrs.ascii ?? font?.attrs.hAnsi;
  if (family) style.fontFamily = family;
  if (Object.keys(style).length) marks.push({ type: 'textStyle', attrs: style });
  const hl = val(child(rPr, 'highlight'));
  const fill = child(rPr, 'shd')?.attrs.fill;
  if (hl && HIGHLIGHT[hl]) marks.push({ type: 'highlight', attrs: { color: HIGHLIGHT[hl] } });
  else if (fill && /^[0-9a-f]{6}$/i.test(fill) && fill.toUpperCase() !== 'FFFFFF') marks.push({ type: 'highlight', attrs: { color: `#${fill.toLowerCase()}` } });
  if (link) marks.push({ type: 'link', attrs: { href: link } });
  return marks;
}

function imageNode(drawing: XmlNode, ctx: Ctx): WordNode | null {
  const blip = find(drawing, 'blip');
  const rid = blip?.attrs.embed;
  const target = rid ? ctx.rels.get(rid) : undefined;
  if (!target) return null;
  const path = target.startsWith('/') ? target.slice(1) : `${ctx.dir}${target.replace(/^\.\//, '')}`;
  const data = ctx.files.get(path.replace(/[^/]+\/\.\.\//g, ''));
  const type = data ? sniffImage(data) : null;
  if (!data || !type) {
    ctx.warnings.add('읽지 못한 그림 형식이 있어 뺐습니다(PNG·JPEG·GIF 만 읽음).');
    return null;
  }
  const ext = find(drawing, 'extent');
  let width = ext ? Math.round(Number(ext.attrs.cx) / EMU) : undefined;
  let height = ext ? Math.round(Number(ext.attrs.cy) / EMU) : undefined;
  if (width && height && width > A4_CONTENT_WIDTH) {
    height = Math.round((height * A4_CONTENT_WIDTH) / width);
    width = A4_CONTENT_WIDTH;
  }
  const alt = find(drawing, 'docPr')?.attrs.descr ?? '';
  return { type: 'image', attrs: { src: toDataUrl(data, type), alt, ...(width ? { width } : {}), ...(height ? { height } : {}) } };
}

function runs(nodes: XmlNode[], ctx: Ctx, link?: string): WordNode[] {
  const out: WordNode[] = [];
  const push = (text: string, marks: WordMark[]) => {
    const last = out[out.length - 1];
    if (last?.type === 'text' && JSON.stringify(last.marks ?? []) === JSON.stringify(marks)) last.text += text;
    else out.push(marks.length ? { type: 'text', text, marks } : { type: 'text', text });
  };
  for (const n of nodes) {
    if (n.name === 'r') {
      const marks = runMarks(child(n, 'rPr'), link);
      for (const c of n.children) {
        if (c.name === 't' && c.text) push(c.text, marks);
        else if (c.name === 'tab') push('\t', marks);
        else if (c.name === 'br' || c.name === 'cr') {
          if (c.attrs.type === 'page') ctx.warnings.add('쪽 나누기는 읽지 않았습니다(본문은 이어서 보입니다).');
          else out.push({ type: 'hardBreak' });
        } else if (c.name === 'drawing' || c.name === 'pict') {
          const img = c.name === 'drawing' ? imageNode(c, ctx) : null;
          if (img) out.push(img);
          else if (c.name === 'pict') ctx.warnings.add('옛 형식 그림·도형은 읽지 않았습니다.');
        } else if (c.name === 'footnoteReference' || c.name === 'endnoteReference') {
          ctx.warnings.add('각주는 읽지 않았습니다.');
        }
      }
    } else if (n.name === 'hyperlink') {
      const href = n.attrs.id ? ctx.rels.get(n.attrs.id) : n.attrs.anchor ? `#${n.attrs.anchor}` : undefined;
      out.push(...runs(n.children, ctx, href ?? link));
    } else if (['ins', 'smartTag', 'customXml', 'fldSimple', 'sdt', 'sdtContent'].includes(n.name)) {
      // 변경 추적의 '넣은 글'·필드·내용 컨트롤 — 안의 글만
      out.push(...runs(n.name === 'sdt' ? (child(n, 'sdtContent')?.children ?? []) : n.children, ctx, link));
    } else if (n.name === 'del') {
      ctx.warnings.add('변경 내용 추적의 지운 글은 뺐습니다.');
    }
  }
  return out;
}

// ── 문단·목록 ──

/** 글자 수 단위(1/100 글자) → pt — 기본 글자 10pt 기준 */
const CHAR_PT = 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** pPr 한 겹(문서 기본값·스타일·문단)의 간격·들여쓰기를 덮어 쓴다 */
function applyPPr(f: ParaFormat, pPr: XmlNode | undefined): void {
  const sp = child(pPr, 'spacing');
  const n = (node: XmlNode | undefined, k: string) => {
    const v = node?.attrs[k];
    return v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined;
  };
  /** 글자·줄 단위 값(1/100) — 0 이면 단위 없는 값을 쓴다(워드 규칙, 한글 문서 변환본이 0 을 함께 적는다) */
  const unit = (node: XmlNode, k: string, size: number) => {
    const v = n(node, k);
    return v ? (v / 100) * size : undefined;
  };
  const twip = (node: XmlNode, k: string) => {
    const v = n(node, k);
    return v !== undefined ? v / 20 : undefined;
  };
  if (sp) {
    const lineUnit = CHAR_PT * WORD_SINGLE_LINE;
    const before = unit(sp, 'beforeLines', lineUnit) ?? twip(sp, 'before');
    const after = unit(sp, 'afterLines', lineUnit) ?? twip(sp, 'after');
    if (before !== undefined) f.spaceBefore = round2(before);
    if (after !== undefined) f.spaceAfter = round2(after);
    const line = n(sp, 'line');
    if (line !== undefined && line > 0) {
      // 배수(auto)는 그대로, 고정·최소(pt)는 기본 글자 크기 기준 배수로 바꾼다(근사 — 다시 저장하면 배수 줄 간격이 된다)
      f.lineHeight = round2(sp.attrs.lineRule === 'exact' || sp.attrs.lineRule === 'atLeast' ? line / 20 / (CHAR_PT * WORD_SINGLE_LINE) : line / 240);
    }
  }
  const ind = child(pPr, 'ind');
  if (ind) {
    const left = unit(ind, 'leftChars', CHAR_PT) ?? unit(ind, 'startChars', CHAR_PT) ?? twip(ind, 'left') ?? twip(ind, 'start');
    if (left !== undefined) f.indent = round2(left);
    const hanging = unit(ind, 'hangingChars', CHAR_PT) ?? twip(ind, 'hanging');
    const first = unit(ind, 'firstLineChars', CHAR_PT) ?? twip(ind, 'firstLine');
    if (hanging !== undefined && hanging > 0) f.firstLine = round2(-hanging);
    else if (first !== undefined) f.firstLine = round2(first);
  }
}

/**
 * 문단 모양 attrs — 워드 기본(간격 0·한 줄) → 문서 기본값 → 스타일(바탕 스타일부터) → 문단 순서로 덮어 쓰고,
 * 그 자리 기본(제목·본문, 표 칸 안·밖)과 같은 값은 뺀다. 목록 문단은 줄 간격만 — 간격·들여쓰기는 목록 모양이 정한다
 */
function paraFormat(ctx: Ctx, pPr: XmlNode | undefined, opts: { heading?: number; list: boolean }): ParaFormat {
  const f: ParaFormat = { lineHeight: 1, spaceBefore: 0, spaceAfter: 0 };
  const chain: (XmlNode | undefined)[] = [];
  for (let k = 0, cur = val(child(pPr, 'pStyle')) ?? ctx.defaultParaStyle; cur && k < 10; k++) {
    const st = ctx.styles.get(cur);
    if (!st) break;
    chain.unshift(st.pPr);
    cur = st.basedOn;
  }
  for (const layer of [ctx.defaultPPr, ...chain, pPr]) applyPPr(f, layer);
  const def = paraDefault(opts.heading, ctx.inCell > 0);
  const out: ParaFormat = {};
  for (const k of opts.list ? (['lineHeight'] as const) : (['lineHeight', 'spaceBefore', 'spaceAfter'] as const)) {
    if (f[k] !== undefined && Math.abs(f[k]! - def[k]) > 0.01) out[k] = f[k];
  }
  if (!opts.list) {
    if (f.indent && f.indent > 0) out.indent = f.indent;
    if (f.firstLine) out.firstLine = f.firstLine;
  }
  return out;
}

interface ParaInfo {
  node: WordNode;
  list?: { numId: string; ilvl: number; bullet: boolean; start: number };
}

function para(p: XmlNode, ctx: Ctx): ParaInfo {
  const pPr = child(p, 'pPr');
  const content = runs(p.children.filter((c) => c.name !== 'pPr'), ctx);
  const jc = val(child(pPr, 'jc'));
  const align = jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : jc === 'both' || jc === 'distribute' ? 'justify' : undefined;
  const level = headingLevel(ctx, pPr);
  // 목록 — 문단에 붙은 번호, 없으면 스타일에 붙은 번호(목록 스타일)
  const numPr = child(pPr, 'numPr');
  const styleId = val(child(pPr, 'pStyle'));
  const numId = val(child(numPr, 'numId')) ?? styleChain(ctx, styleId, (s) => s.numId);
  const ilvl = Number(val(child(numPr, 'ilvl')) ?? styleChain(ctx, styleId, (s) => s.ilvl) ?? 0);
  const isList = !!numId && numId !== '0' && !level;
  const attrs: Record<string, unknown> = { ...paraFormat(ctx, pPr, { heading: level, list: isList }) };
  if (align) attrs.textAlign = align;
  const node: WordNode = level ? { type: 'heading', attrs: { ...attrs, level } } : { type: 'paragraph', ...(Object.keys(attrs).length ? { attrs } : {}) };
  if (content.length) node.content = content;
  if (isList && numId) {
    const lv = ctx.numbering.get(numId)?.get(ilvl);
    return { node, list: { numId, ilvl, bullet: lv?.bullet ?? true, start: lv?.start ?? 1 } };
  }
  return { node };
}

/** 이어진 목록 문단들 → 여러 단계 목록 */
function buildLists(items: ParaInfo[]): WordNode[] {
  const out: WordNode[] = [];
  // 단계마다 열린 목록
  const stack: { list: WordNode; numId: string; bullet: boolean }[] = [];
  for (const it of items) {
    const l = it.list!;
    const depth = Math.min(l.ilvl, stack.length);
    stack.length = Math.min(stack.length, depth + 1);
    // 같은 단계인데 종류·번호가 다르면 새 목록
    if (stack.length === depth + 1 && (stack[depth].bullet !== l.bullet || stack[depth].numId !== l.numId)) stack.length = depth;
    if (stack.length === depth) {
      const list: WordNode = l.bullet ? { type: 'bulletList', content: [] } : { type: 'orderedList', attrs: { start: l.start }, content: [] };
      if (depth === 0) out.push(list);
      else {
        const parentItems = stack[depth - 1].list.content!;
        let parent = parentItems[parentItems.length - 1];
        if (!parent) {
          parent = { type: 'listItem', content: [{ type: 'paragraph' }] };
          parentItems.push(parent);
        }
        parent.content!.push(list);
      }
      stack.push({ list, numId: l.numId, bullet: l.bullet });
    }
    stack[depth].list.content!.push({ type: 'listItem', content: [it.node.type === 'heading' ? { ...it.node, type: 'paragraph', attrs: undefined } : it.node] });
  }
  return out;
}

// ── 표 ──

/** 칸 음영(배경색)·세로 맞춤 — 기본값(흰 바탕·위 맞춤)은 넣지 않는다 */
function cellLook(tcPr: XmlNode | undefined): { background?: string; verticalAlign?: string } {
  const out: { background?: string; verticalAlign?: string } = {};
  const fill = child(tcPr, 'shd')?.attrs.fill;
  if (fill && /^[0-9a-f]{6}$/i.test(fill) && fill.toUpperCase() !== 'FFFFFF') out.background = `#${fill.toLowerCase()}`;
  const v = val(child(tcPr, 'vAlign'));
  if (v === 'center') out.verticalAlign = 'middle';
  else if (v === 'bottom') out.verticalAlign = 'bottom';
  return out;
}

/** 테두리 묶음에서 한 변 — 새 문서는 왼쪽·오른쪽을 start·end 로 쓴다 */
function borderSide(b: XmlNode | undefined, side: string): XmlNode | undefined {
  return child(b, side) ?? (side === 'left' ? child(b, 'start') : side === 'right' ? child(b, 'end') : undefined);
}

function table(tbl: XmlNode, ctx: Ctx): WordNode {
  // 열 너비(px) — 합이 본문 폭을 넘으면 비율로 줄여 표가 종이 밖으로 나가지 않게(바깥 테두리까지 들어가게)
  const rawCols = children(child(tbl, 'tblGrid'), 'gridCol').map((g) => Number(g.attrs.w ?? 0) / TWIP);
  const sum = rawCols.reduce((x, y) => x + y, 0);
  const k = sum > TABLE_MAX_WIDTH ? TABLE_MAX_WIDTH / sum : 1;
  const gridCols = rawCols.map((w) => Math.floor(w * k));
  const rows = children(tbl, 'tr');
  /** tcBorders: 칸 자기 테두리, bottomBorders: 세로로 합친 칸의 맨 아래 칸 테두리(합친 칸 아래 변) */
  /**
   * tcBorders: 칸 자기 테두리. merged: 세로로 합친 칸 — 아래 변은 맨 아래 이어진 칸의 테두리(bottomBorders, 없으면 표 테두리).
   * rowStart·rowEnd: 그 줄 칸들이 차지한 처음·끝 열(gridBefore 로 들쭉날쭉한 줄도 줄의 첫·끝 칸이 가장자리)
   */
  type Cell = { node: WordNode; col: number; span: number; row: number; tcBorders?: XmlNode; merged?: boolean; bottomBorders?: XmlNode; rowStart: number; rowEnd: number };
  const grid: Cell[][] = [];
  /** 줄마다 높이(px) — 워드 '행 높이'. 정하지 않은 줄은 undefined */
  const heights: (number | undefined)[] = [];
  /** 열 자리 → 세로 합침이 시작된 칸(아래 줄 'continue' 가 이 칸의 rowspan 을 늘린다) */
  const open = new Map<number, Cell>();
  rows.forEach((tr) => {
    const out: Cell[] = [];
    let col = 0;
    const before = Number(val(child(child(tr, 'trPr'), 'gridBefore')) ?? 0);
    col += before;
    for (const tc of children(tr, 'tc')) {
      const tcPr = child(tc, 'tcPr');
      const span = Math.max(1, Number(val(child(tcPr, 'gridSpan')) ?? 1));
      const vm = child(tcPr, 'vMerge');
      const vmVal = vm ? (vm.attrs.val ?? 'continue') : undefined;
      if (vmVal === 'continue' && open.has(col)) {
        const top = open.get(col)!;
        top.node.attrs!.rowspan = Number(top.node.attrs!.rowspan ?? 1) + 1;
        top.merged = true;
        top.bottomBorders = child(tcPr, 'tcBorders');
        col += span;
        continue;
      }
      const widths = gridCols.slice(col, col + span);
      ctx.inCell++;
      const content = blocks(tc.children, ctx);
      ctx.inCell--;
      const node: WordNode = {
        type: 'tableCell',
        attrs: {
          colspan: span,
          rowspan: 1,
          colwidth: widths.length === span && widths.every((w) => w > 0) ? widths : null,
          ...cellLook(tcPr),
        },
        content: content.length ? content : [{ type: 'paragraph' }],
      };
      const cell: Cell = { node, col, span, row: grid.length, tcBorders: child(tcPr, 'tcBorders'), rowStart: before, rowEnd: 0 };
      if (vmVal === 'restart') open.set(col, cell);
      else for (let k = 0; k < span; k++) open.delete(col + k);
      out.push(cell);
      col += span;
    }
    for (const c of out) c.rowEnd = col;
    grid.push(out);
    heights.push(rowHeight(child(tr, 'trPr')));
  });
  // 칸 테두리 — 칸에 정한 변, 없으면 표 테두리(가장자리 변은 표 바깥선, 안쪽 변은 안쪽 선). 표에도 없으면 선 없음(워드와 같게)
  const tblPr = child(tbl, 'tblPr');
  const own = child(tblPr, 'tblBorders');
  // 표 스타일(없으면 문서 기본 표 스타일) — 변마다 바탕 스타일까지 따라간다
  const styleId = val(child(tblPr, 'tblStyle')) ?? ctx.defaultTableStyle;
  const tableSide = (side: string) => borderSide(own, side) ?? styleChain(ctx, styleId, (st) => borderSide(st.tblBorders, side));
  grid.forEach((cells, ri) => {
    for (const c of cells) {
      const rspan = Number(c.node.attrs!.rowspan ?? 1);
      const edge = { top: ri === 0, bottom: ri + rspan >= grid.length, left: c.col <= c.rowStart, right: c.col + c.span >= c.rowEnd };
      const borders: CellBorders = {};
      for (const side of BORDER_SIDES) {
        const mine = borderSide(side === 'bottom' && c.merged ? c.bottomBorders : c.tcBorders, side);
        const n = mine ?? tableSide(edge[side] ? side : side === 'top' || side === 'bottom' ? 'insideH' : 'insideV');
        borders[side] = n ? borderFromWord(n.attrs) : { style: 'none', width: 0, color: '#000000' };
      }
      c.node.attrs!.borders = borders;
    }
  });
  // 칸이 하나도 없는 줄(모두 위에서 합쳐 내려온 칸)은 편집기가 그릴 수 없어 빼고, 그 줄까지 센 rowspan 도 하나씩 줄인다
  grid.forEach((cells, ri) => {
    if (cells.length) return;
    for (const c of grid.flat()) {
      const span = Number(c.node.attrs!.rowspan ?? 1);
      if (c.row < ri && c.row + span > ri) c.node.attrs!.rowspan = span - 1;
    }
  });
  const tableRows = grid
    .map((r, ri): WordNode | null =>
      r.length ? { type: 'tableRow', ...(heights[ri] ? { attrs: { height: heights[ri] } } : {}), content: r.map((c) => c.node) } : null,
    )
    .filter((r): r is WordNode => r !== null);
  return { type: 'table', content: tableRows };
}

/** 행 높이(px) — 워드는 '최소'(atLeast, 기본)·'고정'(exact) 둘 다 쓰지만 화면은 최소 높이로 맞춘다(글이 넘쳐 잘리지 않게) */
function rowHeight(trPr: XmlNode | undefined): number | undefined {
  const h = child(trPr, 'trHeight');
  const twips = Number(h?.attrs.val);
  return h && h.attrs.hRule !== 'auto' && twips > 0 ? Math.round(twips / TWIP) : undefined;
}

// ── 블록 ──

function blocks(nodes: XmlNode[], ctx: Ctx): WordNode[] {
  const out: WordNode[] = [];
  let pending: ParaInfo[] = [];
  const flush = () => {
    if (pending.length) out.push(...buildLists(pending));
    pending = [];
  };
  for (const n of nodes) {
    if (n.name === 'p') {
      const info = para(n, ctx);
      if (info.list) pending.push(info);
      else {
        flush();
        out.push(info.node);
      }
    } else if (n.name === 'tbl') {
      flush();
      out.push(table(n, ctx));
    } else if (n.name === 'sdt') {
      flush();
      out.push(...blocks(child(n, 'sdtContent')?.children ?? [], ctx));
    } else if (n.name === 'customXml') {
      flush();
      out.push(...blocks(n.children, ctx));
    }
  }
  flush();
  return out;
}

/** 그 종류의 기본 스타일 id(w:default="1") */
function defaultStyle(stylesEl: XmlNode | undefined, type: string): string | undefined {
  return children(stylesEl, 'style').find((st) => st.attrs.type === type && ['1', 'true', 'on'].includes(st.attrs.default ?? ''))?.attrs.styleId;
}

/** .docx 바이트 → 문서 */
export async function importDocx(bytes: Uint8Array): Promise<DocxImport> {
  let files: Map<string, Uint8Array>;
  try {
    files = await unzip(bytes);
  } catch (e) {
    throw new DocxError(e instanceof Error ? e.message : '워드 파일을 읽지 못했습니다.');
  }
  // 본문 위치 — 보통 word/document.xml, 아니면 꾸러미 관계에서 찾는다
  let mainPath = 'word/document.xml';
  if (!files.has(mainPath)) {
    const rel = children(find(read(files, '_rels/.rels'), 'Relationships'), 'Relationship').find((r) => /officeDocument$/.test(r.attrs.Type ?? ''));
    mainPath = (rel?.attrs.Target ?? '').replace(/^\//, '');
  }
  const main = read(files, mainPath);
  const body = find(main, 'body');
  if (!body) throw new DocxError('워드(.docx) 문서가 아닙니다.');
  const dir = mainPath.slice(0, mainPath.lastIndexOf('/') + 1);
  const relsPath = `${dir}_rels/${mainPath.slice(dir.length)}.rels`;
  const rels = new Map<string, string>();
  for (const r of children(find(read(files, relsPath), 'Relationships'), 'Relationship')) {
    if (r.attrs.Id && r.attrs.Target) rels.set(r.attrs.Id, r.attrs.Target);
  }
  const stylesRoot = find(read(files, `${dir}styles.xml`), 'styles');
  const ctx: Ctx = {
    styles: readStyles(stylesRoot),
    numbering: readNumbering(read(files, `${dir}numbering.xml`)),
    rels,
    files,
    warnings: new Set(),
    dir,
    defaultPPr: child(child(child(stylesRoot, 'docDefaults'), 'pPrDefault'), 'pPr'),
    defaultParaStyle: defaultStyle(stylesRoot, 'paragraph'),
    defaultTableStyle: defaultStyle(stylesRoot, 'table'),
    inCell: 0,
  };
  if (files.has(`${dir}header1.xml`) || files.has(`${dir}footer1.xml`)) ctx.warnings.add('머리글·바닥글은 읽지 않았습니다.');
  if (files.has(`${dir}comments.xml`)) ctx.warnings.add('메모는 읽지 않았습니다.');
  const content = blocks(body.children, ctx);
  return { doc: content.length ? { type: 'doc', content } : emptyWordDoc(), warnings: [...ctx.warnings] };
}
