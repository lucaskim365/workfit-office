/**
 * 워드(.docx) 불러오기 — 외부 라이브러리 없이 .docx 를 문서 JSON(model.ts)으로 읽는다.
 * 읽는 것: 문단·제목(스타일 이름·개요 수준)·정렬, 글자(굵게·기울임·밑줄·취소선·크기·색·글꼴·형광펜·음영), 링크, 줄바꿈·탭,
 *          글머리·번호 목록(여러 단계), 표(가로·세로 합친 칸·열 너비), 그림(PNG·JPEG·GIF).
 * 읽지 않는 것: 머리글·바닥글, 각주, 메모, 변경 내용 추적, 글상자·도형, 쪽 나누기·단(본문 흐름만 읽는다)
 */
import { A4_CONTENT_WIDTH, emptyWordDoc, type WordMark, type WordNode } from './model';
import { sniffImage, toDataUrl } from './image';
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
}

const dec = new TextDecoder();
const read = (files: Map<string, Uint8Array>, path: string) => {
  const b = files.get(path);
  return b ? parseXml(dec.decode(b)) : undefined;
};
const val = (n: XmlNode | undefined) => n?.attrs.val;
/** 켜짐/꺼짐 속성(<w:b/>, <w:b w:val="0"/>) */
const on = (n: XmlNode | undefined) => !!n && !['0', 'false', 'off', 'none'].includes(String(n.attrs.val ?? '').toLowerCase());

function readStyles(root: XmlNode | undefined): Map<string, StyleInfo> {
  const out = new Map<string, StyleInfo>();
  for (const s of children(find(root, 'styles'), 'style')) {
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
  const attrs: Record<string, unknown> = {};
  if (align) attrs.textAlign = align;
  const node: WordNode = level ? { type: 'heading', attrs: { ...attrs, level } } : { type: 'paragraph', ...(align ? { attrs } : {}) };
  if (content.length) node.content = content;
  // 목록 — 문단에 붙은 번호, 없으면 스타일에 붙은 번호(목록 스타일)
  const numPr = child(pPr, 'numPr');
  const styleId = val(child(pPr, 'pStyle'));
  const numId = val(child(numPr, 'numId')) ?? styleChain(ctx, styleId, (s) => s.numId);
  const ilvl = Number(val(child(numPr, 'ilvl')) ?? styleChain(ctx, styleId, (s) => s.ilvl) ?? 0);
  if (numId && numId !== '0' && !level) {
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

function table(tbl: XmlNode, ctx: Ctx): WordNode {
  const gridCols = children(child(tbl, 'tblGrid'), 'gridCol').map((g) => Math.round(Number(g.attrs.w ?? 0) / TWIP));
  const rows = children(tbl, 'tr');
  type Cell = { node: WordNode; col: number; span: number; row: number };
  const grid: Cell[][] = [];
  /** 열 자리 → 세로 합침이 시작된 칸(아래 줄 'continue' 가 이 칸의 rowspan 을 늘린다) */
  const open = new Map<number, WordNode>();
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
        top.attrs!.rowspan = Number(top.attrs!.rowspan ?? 1) + 1;
        col += span;
        continue;
      }
      const widths = gridCols.slice(col, col + span);
      const content = blocks(tc.children, ctx);
      const node: WordNode = {
        type: 'tableCell',
        attrs: { colspan: span, rowspan: 1, colwidth: widths.length === span && widths.every((w) => w > 0) ? widths : null },
        content: content.length ? content : [{ type: 'paragraph' }],
      };
      if (vmVal === 'restart') open.set(col, node);
      else for (let k = 0; k < span; k++) open.delete(col + k);
      out.push({ node, col, span, row: grid.length });
      col += span;
    }
    grid.push(out);
  });
  // 칸이 하나도 없는 줄(모두 위에서 합쳐 내려온 칸)은 편집기가 그릴 수 없어 빼고, 그 줄까지 센 rowspan 도 하나씩 줄인다
  grid.forEach((cells, ri) => {
    if (cells.length) return;
    for (const c of grid.flat()) {
      const span = Number(c.node.attrs!.rowspan ?? 1);
      if (c.row < ri && c.row + span > ri) c.node.attrs!.rowspan = span - 1;
    }
  });
  return { type: 'table', content: grid.filter((r) => r.length).map((r) => ({ type: 'tableRow', content: r.map((c) => c.node) })) };
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
  const ctx: Ctx = {
    styles: readStyles(read(files, `${dir}styles.xml`)),
    numbering: readNumbering(read(files, `${dir}numbering.xml`)),
    rels,
    files,
    warnings: new Set(),
    dir,
  };
  if (files.has(`${dir}header1.xml`) || files.has(`${dir}footer1.xml`)) ctx.warnings.add('머리글·바닥글은 읽지 않았습니다.');
  if (files.has(`${dir}comments.xml`)) ctx.warnings.add('메모는 읽지 않았습니다.');
  const content = blocks(body.children, ctx);
  return { doc: content.length ? { type: 'doc', content } : emptyWordDoc(), warnings: [...ctx.warnings] };
}
