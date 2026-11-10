/**
 * 워드(.docx) 저장 — 외부 라이브러리 없이 문서 JSON(model.ts)을 .docx 로 만든다.
 * 담는 것: 문단·제목(1~6)·정렬, 글자(굵게·기울임·밑줄·취소선·코드·크기·색·글꼴·형광펜·배경), 링크, 줄바꿈,
 *          글머리·번호 목록(여러 단계), 인용, 구분선, 표(칸 합치기·열 너비·머리 칸), 그림(PNG·JPEG·GIF).
 * 쪽은 A4 세로, 여백 2.54cm(편집 화면과 같음). 글꼴은 맑은 고딕 10pt.
 */
import { A4, A4_CONTENT_WIDTH, TABLE_MAX_WIDTH, type WordMark, type WordNode } from './model';
import { imageSize, loadImage, type ImageType } from './image';
import { zip } from './zip';

export interface DocxExportOptions {
  /** 문서 정보의 제목 */
  title?: string;
  /** 그림 주소 → 바이트(로그인이 필요한 파일 서버 등). 없으면 data URL·http 를 직접 받는다 */
  loadImage?: (src: string) => Promise<{ data: Uint8Array; type: ImageType } | null>;
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
};
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
/** px → twip(1/20pt), px → EMU */
const TWIP = 15;
const EMU = 9525;
const FONT = '맑은 고딕';
/** 기본 글자 크기(반 pt 단위) — 10pt */
const BASE_HALF_PT = 20;

function esc(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** '#rrggbb'·'#rgb'·'rgb(r,g,b)' → 'RRGGBB'. 못 읽으면 undefined */
export function hexColor(c: unknown): string | undefined {
  if (typeof c !== 'string') return undefined;
  const s = c.trim();
  let m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (m) return m[1].toUpperCase();
  m = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m) return (m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toUpperCase();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((x) => Math.min(255, Number(x)).toString(16).padStart(2, '0')).join('').toUpperCase();
  return undefined;
}

/** '14pt'·'18px'·'14' → 반 pt 단위(w:sz). 못 읽으면 undefined */
export function halfPoints(size: unknown): number | undefined {
  if (typeof size !== 'string' && typeof size !== 'number') return undefined;
  const m = /^\s*([\d.]+)\s*(pt|px)?\s*$/i.exec(String(size));
  if (!m) return undefined;
  const n = Number(m[1]);
  const pt = m[2]?.toLowerCase() === 'px' ? n * 0.75 : n;
  return pt > 0 ? Math.round(pt * 2) : undefined;
}

const JC: Record<string, string> = { left: 'left', center: 'center', right: 'right', justify: 'both' };

interface Ctx {
  rels: string[];
  media: [string, Uint8Array][];
  /** 번호 목록마다 새 번호(1부터 다시) — numId 3부터. 1=글머리, 2=번호(기본) */
  nums: { id: number; abstract: number; start: number }[];
  imageId: number;
  opts: DocxExportOptions;
}

function addRel(ctx: Ctx, type: string, target: string, external = false): string {
  const id = `rId${ctx.rels.length + 10}`;
  ctx.rels.push(`<Relationship Id="${id}" Type="${REL}/${type}" Target="${esc(target)}"${external ? ' TargetMode="External"' : ''}/>`);
  return id;
}

// ── 글(run) ──

function runProps(marks: WordMark[] = []): string {
  const out: string[] = [];
  const has = (t: string) => marks.find((m) => m.type === t);
  const ts = has('textStyle')?.attrs ?? {};
  // 워드 rPr 자식 순서(rFonts → b → i → strike → color → sz → u → shd)를 지킨다 — 순서가 틀리면 워드가 파일이 손상됐다고 본다
  if (has('code')) out.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
  else if (ts.fontFamily && typeof ts.fontFamily === 'string') {
    const f = esc(ts.fontFamily.split(',')[0].replace(/['"]/g, '').trim());
    out.push(`<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:eastAsia="${f}"/>`);
  }
  if (has('bold')) out.push('<w:b/><w:bCs/>');
  if (has('italic')) out.push('<w:i/><w:iCs/>');
  if (has('strike')) out.push('<w:strike/>');
  const link = has('link');
  const color = hexColor(ts.color) ?? (link ? '0563C1' : undefined);
  if (color) out.push(`<w:color w:val="${color}"/>`);
  const sz = halfPoints(ts.fontSize);
  if (sz) out.push(`<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`);
  if (has('underline') || link) out.push('<w:u w:val="single"/>');
  const hl = has('highlight');
  const fill = hexColor(hl ? (hl.attrs?.color ?? '#fff59d') : ts.backgroundColor) ?? (has('code') ? 'F2F2F2' : undefined);
  if (fill) out.push(`<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`);
  return out.length ? `<w:rPr>${out.join('')}</w:rPr>` : '';
}

async function imageRun(node: WordNode, ctx: Ctx): Promise<string> {
  const src = String(node.attrs?.src ?? '');
  const img = await (ctx.opts.loadImage ?? loadImage)(src);
  if (!img) return node.attrs?.alt ? `<w:r><w:t xml:space="preserve">[그림: ${esc(String(node.attrs.alt))}]</w:t></w:r>` : '';
  const n = ++ctx.imageId;
  const name = `image${n}.${img.type === 'jpeg' ? 'jpeg' : img.type}`;
  ctx.media.push([`word/media/${name}`, img.data]);
  const rid = addRel(ctx, 'image', `media/${name}`);
  const natural = imageSize(img.data) ?? { width: 300, height: 200 };
  let w = Number(node.attrs?.width) || natural.width;
  let h = Number(node.attrs?.height) || (natural.height * w) / natural.width;
  // 본문 폭보다 크면 줄인다(비율 그대로)
  if (w > A4_CONTENT_WIDTH) {
    h = (h * A4_CONTENT_WIDTH) / w;
    w = A4_CONTENT_WIDTH;
  }
  const cx = Math.round(w * EMU);
  const cy = Math.round(h * EMU);
  const alt = esc(String(node.attrs?.alt ?? ''));
  return (
    '<w:r><w:drawing>' +
    `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="그림 ${n}" descr="${alt}"/>` +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    `<a:graphic><a:graphicData uri="${NS.pic}"><pic:pic>` +
    `<pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
  );
}

/** 글 사이 노드들(text·hardBreak·image) → run 들. 링크는 w:hyperlink 로 묶는다 */
async function inlines(nodes: WordNode[] = [], ctx: Ctx): Promise<string> {
  const out: string[] = [];
  for (const n of nodes) {
    let xml = '';
    if (n.type === 'text') {
      const parts = (n.text ?? '').split('\t');
      const body = parts.map((t, i) => (i ? '<w:tab/>' : '') + (t ? `<w:t xml:space="preserve">${esc(t)}</w:t>` : '')).join('');
      xml = `<w:r>${runProps(n.marks)}${body}</w:r>`;
      const link = n.marks?.find((m) => m.type === 'link');
      const href = typeof link?.attrs?.href === 'string' ? link.attrs.href : '';
      if (href) xml = `<w:hyperlink r:id="${addRel(ctx, 'hyperlink', href, true)}">${xml}</w:hyperlink>`;
    } else if (n.type === 'hardBreak') {
      xml = '<w:r><w:br/></w:r>';
    } else if (n.type === 'image') {
      xml = await imageRun(n, ctx);
    }
    out.push(xml);
  }
  return out.join('');
}

// ── 문단 ──

interface ParaOpts {
  style?: string;
  num?: { id: number; level: number };
  /** 목록 항목 안 두 번째 문단부터 — 글머리 없이 들여쓰기만 */
  indentLevel?: number;
  border?: boolean;
  /** 위아래 간격 없이(표 칸 안) */
  tight?: boolean;
}

async function paragraph(node: WordNode, ctx: Ctx, p: ParaOpts = {}): Promise<string> {
  const pPr: string[] = [];
  const style = node.type === 'heading' ? `Heading${Math.min(6, Math.max(1, Number(node.attrs?.level) || 1))}` : p.style;
  if (style) pPr.push(`<w:pStyle w:val="${style}"/>`);
  // 자식 순서는 워드 규칙대로(pStyle → numPr → pBdr → spacing → ind → contextualSpacing → jc) — 틀리면 '읽을 수 없는 내용'
  if (p.num) pPr.push(`<w:numPr><w:ilvl w:val="${p.num.level}"/><w:numId w:val="${p.num.id}"/></w:numPr>`);
  if (p.border) pPr.push('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="BFBFBF"/></w:pBdr>');
  // 표 칸 안은 위아래 간격 없이
  if (p.tight) pPr.push('<w:spacing w:before="0" w:after="0"/>');
  if (p.indentLevel !== undefined) pPr.push(`<w:ind w:left="${(p.indentLevel + 1) * 720}"/>`);
  // 목록 항목끼리는 문단 간격을 두지 않는다(워드 '같은 스타일 문단 사이 간격 없음')
  if (p.num || p.indentLevel !== undefined) pPr.push('<w:contextualSpacing/>');
  const jc = JC[String(node.attrs?.textAlign ?? '')];
  if (jc && jc !== 'left') pPr.push(`<w:jc w:val="${jc}"/>`);
  return `<w:p>${pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''}${await inlines(node.content, ctx)}</w:p>`;
}

// ── 표 ──

/** 칸 음영·세로 맞춤 — tcPr 자식 순서(gridSpan → vMerge → shd → vAlign)를 지킨다. 머리 칸은 정한 색이 없으면 연회색 */
function cellLookXml(cell: WordNode, head: boolean): string {
  const fill = hexColor(cell.attrs?.background) ?? (head ? 'F2F2F2' : undefined);
  const v = cell.attrs?.verticalAlign;
  const jc = v === 'middle' ? 'center' : v === 'bottom' ? 'bottom' : undefined;
  return (fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : '') + (jc ? `<w:vAlign w:val="${jc}"/>` : '');
}

async function table(node: WordNode, ctx: Ctx): Promise<string> {
  const rows = node.content ?? [];
  // 칸 자리(격자) — rowspan 으로 아래 줄까지 덮는 칸은 아래 줄에 '이어 합침(vMerge)' 칸을 넣어야 워드가 맞게 그린다
  const covered: Map<number, { span: number; left: number }>[] = rows.map(() => new Map());
  let gridCols = 0;
  const widths: number[] = [];
  const layout = rows.map((row, ri) => {
    let col = 0;
    const cells = (row.content ?? []).map((cell) => {
      while (covered[ri].has(col)) col += covered[ri].get(col)!.span;
      const span = Math.max(1, Number(cell.attrs?.colspan) || 1);
      const rspan = Math.max(1, Number(cell.attrs?.rowspan) || 1);
      const cw = Array.isArray(cell.attrs?.colwidth) ? (cell.attrs!.colwidth as unknown[]) : [];
      for (let k = 0; k < span; k++) if (Number(cw[k]) > 0 && widths[col + k] === undefined) widths[col + k] = Number(cw[k]);
      for (let k = 1; k < rspan && ri + k < rows.length; k++) covered[ri + k].set(col, { span, left: rspan - k });
      const at = col;
      col += span;
      return { cell, at, span, rspan };
    });
    while (covered[ri].has(col)) col += covered[ri].get(col)!.span;
    gridCols = Math.max(gridCols, col);
    return cells;
  });
  // 열 너비 — 정한 열은 그대로, 나머지는 남은 폭을 나눠서. 표 최대 폭(불러올 때와 같은 기준)을 넘으면 비율로 줄인다
  const fixed = widths.slice(0, gridCols).reduce<number>((a, b) => a + (b ?? 0), 0);
  const free = Array.from({ length: gridCols }, (_, i) => widths[i] === undefined).filter(Boolean).length;
  const each = free ? Math.max(40, (TABLE_MAX_WIDTH - fixed) / free) : 0;
  let cols = Array.from({ length: gridCols }, (_, i) => widths[i] ?? each);
  const total = cols.reduce((a, b) => a + b, 0);
  if (total > TABLE_MAX_WIDTH) cols = cols.map((w) => (w * TABLE_MAX_WIDTH) / total);
  const tw = (px: number) => Math.round(px * TWIP);
  const border = (tag: string) => `<w:${tag} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`;
  const out: string[] = [
    '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/>' +
      `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders>` +
      '<w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>',
    `<w:tblGrid>${cols.map((w) => `<w:gridCol w:w="${tw(w)}"/>`).join('')}</w:tblGrid>`,
  ];
  for (let ri = 0; ri < rows.length; ri++) {
    const tcs: string[] = [];
    const cells = [...layout[ri]];
    // 격자 순서대로 — 위에서 내려온 합친 칸 자리에는 '이어 합침' 칸
    const slots: { at: string; xml: () => Promise<string> }[] = [];
    covered[ri].forEach((v, at) => {
      const w = cols.slice(at, at + v.span).reduce((a, b) => a + b, 0);
      slots.push({ at: String(at).padStart(4, '0'), xml: async () => `<w:tc><w:tcPr><w:tcW w:w="${tw(w)}" w:type="dxa"/>${v.span > 1 ? `<w:gridSpan w:val="${v.span}"/>` : ''}<w:vMerge/></w:tcPr><w:p/></w:tc>` });
    });
    for (const c of cells) {
      slots.push({
        at: String(c.at).padStart(4, '0'),
        xml: async () => {
          const w = cols.slice(c.at, c.at + c.span).reduce((a, b) => a + b, 0);
          const head = c.cell.type === 'tableHeader';
          const tcPr =
            `<w:tcW w:w="${tw(w)}" w:type="dxa"/>` +
            (c.span > 1 ? `<w:gridSpan w:val="${c.span}"/>` : '') +
            (c.rspan > 1 ? '<w:vMerge w:val="restart"/>' : '') +
            cellLookXml(c.cell, head);
          let body = await blocks(c.cell.content ?? [], ctx, { bold: head, tight: true });
          if (!body.includes('<w:p')) body += '<w:p/>';
          // 표 칸은 문단으로 끝나야 한다
          if (body.endsWith('</w:tbl>')) body += '<w:p/>';
          return `<w:tc><w:tcPr>${tcPr}</w:tcPr>${body}</w:tc>`;
        },
      });
    }
    slots.sort((a, b) => a.at.localeCompare(b.at));
    for (const s of slots) tcs.push(await s.xml());
    // 행 높이(px) → 워드 '최소' 행 높이(글이 늘면 행도 늘어난다)
    const h = Number(rows[ri].attrs?.height);
    const trPr = h > 0 ? `<w:trPr><w:trHeight w:val="${tw(h)}"/></w:trPr>` : '';
    out.push(`<w:tr>${trPr}${tcs.join('')}</w:tr>`);
  }
  out.push('</w:tbl>');
  return out.join('');
}

// ── 목록 ──

async function list(node: WordNode, ctx: Ctx, level: number, numId: number): Promise<string> {
  const out: string[] = [];
  for (const item of node.content ?? []) {
    let first = true;
    for (const child of item.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        out.push(await listBlock(child, ctx, level + 1));
      } else if (child.type === 'paragraph' || child.type === 'heading') {
        out.push(await paragraph(child, ctx, first ? { num: { id: numId, level } } : { indentLevel: level }));
        first = false;
      } else {
        out.push(await blocks([child], ctx));
        first = false;
      }
    }
  }
  return out.join('');
}

async function listBlock(node: WordNode, ctx: Ctx, level: number): Promise<string> {
  if (node.type === 'bulletList') return list(node, ctx, level, 1);
  // 번호 목록은 목록마다 1부터(또는 start 부터) 다시 — 목록마다 새 번호 정의
  const start = Math.max(1, Number(node.attrs?.start) || 1);
  const id = 3 + ctx.nums.length;
  ctx.nums.push({ id, abstract: 1, start });
  return list(node, ctx, level, id);
}

// ── 블록 ──

async function blocks(nodes: WordNode[], ctx: Ctx, opts: { bold?: boolean; tight?: boolean } = {}): Promise<string> {
  const out: string[] = [];
  for (const n of nodes) {
    // 머리 칸 글은 굵게
    const node = opts.bold ? boldify(n) : n;
    switch (node.type) {
      case 'paragraph':
      case 'heading':
        out.push(await paragraph(node, ctx, { tight: opts.tight }));
        break;
      case 'bulletList':
      case 'orderedList':
        out.push(await listBlock(node, ctx, 0));
        break;
      case 'blockquote':
        for (const child of node.content ?? []) {
          out.push(child.type === 'paragraph' ? await paragraph(child, ctx, { style: 'Quote' }) : await blocks([child], ctx));
        }
        break;
      case 'horizontalRule':
        out.push(await paragraph({ type: 'paragraph' }, ctx, { border: true }));
        break;
      case 'table':
        out.push(await table(node, ctx));
        break;
      case 'codeBlock':
        for (const line of (node.content ?? []).map((t) => t.text ?? '').join('').split('\n')) {
          out.push(await paragraph({ type: 'paragraph', content: line ? [{ type: 'text', text: line, marks: [{ type: 'code' }] }] : [] }, ctx));
        }
        break;
      case 'image':
        out.push(`<w:p>${await imageRun(node, ctx)}</w:p>`);
        break;
      default:
        if (node.content) out.push(await blocks(node.content, ctx));
    }
  }
  return out.join('');
}

function boldify(n: WordNode): WordNode {
  if (n.type === 'text') return n.marks?.some((m) => m.type === 'bold') ? n : { ...n, marks: [...(n.marks ?? []), { type: 'bold' }] };
  return n.content ? { ...n, content: n.content.map(boldify) } : n;
}

// ── 고정 부품 ──

const LEVEL_IND = (lvl: number) => `<w:pPr><w:ind w:left="${(lvl + 1) * 720}" w:hanging="360"/></w:pPr>`;
const BULLETS = ['•', '◦', '▪'];
const DECIMAL_FMT = ['decimal', 'lowerLetter', 'lowerRoman'];

function numberingXml(nums: Ctx['nums']): string {
  const lvls = (kind: 'bullet' | 'decimal') =>
    Array.from({ length: 9 }, (_, l) =>
      kind === 'bullet'
        ? `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${BULLETS[l % 3]}"/><w:lvlJc w:val="left"/>${LEVEL_IND(l)}</w:lvl>`
        : `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="${DECIMAL_FMT[l % 3]}"/><w:lvlText w:val="%${l + 1}."/><w:lvlJc w:val="left"/>${LEVEL_IND(l)}</w:lvl>`
    ).join('');
  return (
    XML_HEAD +
    `<w:numbering xmlns:w="${NS.w}">` +
    `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${lvls('bullet')}</w:abstractNum>` +
    `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${lvls('decimal')}</w:abstractNum>` +
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
    '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' +
    nums
      .map((n) => `<w:num w:numId="${n.id}"><w:abstractNumId w:val="${n.abstract}"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="${n.start}"/></w:lvlOverride></w:num>`)
      .join('') +
    '</w:numbering>'
  );
}

function stylesXml(): string {
  const heading = (n: number, halfPt: number) =>
    `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>` +
    `<w:pPr><w:keepNext/><w:spacing w:before="${n <= 2 ? 360 : 240}" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="${halfPt}"/><w:szCs w:val="${halfPt}"/></w:rPr></w:style>`;
  return (
    XML_HEAD +
    `<w:styles xmlns:w="${NS.w}">` +
    `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT}" w:cs="${FONT}"/><w:sz w:val="${BASE_HALF_PT}"/><w:szCs w:val="${BASE_HALF_PT}"/><w:lang w:val="ko-KR" w:eastAsia="ko-KR"/></w:rPr></w:rPrDefault>` +
    '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    heading(1, 36) +
    heading(2, 30) +
    heading(3, 26) +
    heading(4, 24) +
    heading(5, 22) +
    heading(6, 20) +
    '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="BFBFBF"/></w:pBdr><w:ind w:left="360"/></w:pPr><w:rPr><w:color w:val="595959"/></w:rPr></w:style>' +
    '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
    '</w:styles>'
  );
}

/** 문서 → .docx 바이트 */
export async function exportDocx(doc: WordNode, opts: DocxExportOptions = {}): Promise<Uint8Array> {
  const ctx: Ctx = { rels: [], media: [], nums: [], imageId: 0, opts };
  let body = await blocks(doc.content ?? [], ctx);
  if (!body) body = '<w:p/>';
  const m = A4.margin * TWIP;
  const documentXml =
    XML_HEAD +
    `<w:document xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}"><w:body>` +
    body +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${m}" w:right="${m}" w:bottom="${m}" w:left="${m}" w:header="851" w:footer="992" w:gutter="0"/></w:sectPr>` +
    '</w:body></w:document>';
  const hasMedia = ctx.media.length > 0;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const files: [string, string | Uint8Array][] = [
    [
      '[Content_Types].xml',
      XML_HEAD +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        (hasMedia ? '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/>' : '') +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '</Types>',
    ],
    [
      '_rels/.rels',
      XML_HEAD +
        `<Relationships xmlns="${NS.rel}">` +
        `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>` +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '</Relationships>',
    ],
    [
      'docProps/core.xml',
      XML_HEAD +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        `<dc:title>${esc(opts.title ?? '')}</dc:title>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
        '</cp:coreProperties>',
    ],
    ['word/document.xml', documentXml],
    ['word/styles.xml', stylesXml()],
    ['word/numbering.xml', numberingXml(ctx.nums)],
    [
      'word/_rels/document.xml.rels',
      XML_HEAD +
        `<Relationships xmlns="${NS.rel}">` +
        `<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>` +
        `<Relationship Id="rId2" Type="${REL}/numbering" Target="numbering.xml"/>` +
        ctx.rels.join('') +
        '</Relationships>',
    ],
    ...ctx.media,
  ];
  return zip(files);
}

/** 브라우저에서 .docx 로 받기 */
export function downloadDocx(bytes: Uint8Array, fileName: string): void {
  const name = /\.docx$/i.test(fileName) ? fileName : `${fileName}.docx`;
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]/g, '_');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
