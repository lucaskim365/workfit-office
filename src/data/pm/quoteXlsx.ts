import { unzip, zip } from '@/lib/sheet/zip';
import { colIndex as colIndex0, colLetter as colLetter0 } from '@/lib/sheet/formula';
import { PL_CATS } from '@/domain/pm/money';
import { ETC_CAT, QT_SEC_TITLE, qAmt, qBuy, qNum, type FundLine, type FundOf, type PmQuote, type PmQuoteItem } from '@/domain/pm/quote';

/**
 * 견적서 엑셀 내보내기 (데모 qExport 5070) — 6-5.
 * 회사 견적서 양식(명성ENG 2026-11-06 파일, 데모 QT_TPL = `seed/quote-template.xlsx`)을 틀로 쓰고 숫자 · 수식만 채움 → 엑셀과 화면 숫자가 같음.
 * 틀의 19행부터 아래를 지우고 품목 수에 맞게 다시 씀 — 각 줄 모양(글꼴 · 테두리 · 칸 합치기 · 높이)은 틀의 같은 종류 줄을 복사.
 * 수식도 넣고 계산값도 같이 넣어서, 엑셀을 열면 다시 계산되고 미리보기에서도 숫자가 보임.
 *
 * 데모는 ExcelJS(인터넷에서 불러옴)로 틀을 읽고 썼다. 여기서는 그룹웨어의 ZIP 도구(`lib/sheet/zip`)로 틀의 XML 을 직접 고친다
 * (패키지 추가 · 외부 스크립트 없음). 모양 번호(s)는 틀 그대로라 글꼴 · 테두리가 틀과 같다.
 */

export interface QuoteXlsxInput {
  q: PmQuote;
  kind: '정부지원' | '자체';
  /** 사업 짧은 이름 (시트 이름 '신광(견적)') */
  short: string;
  /** 도입기업 (표지 제목 · 파일 이름) */
  company: string;
  /** 사업비 현황 (정부지원일 때) — 화면과 같은 계산 */
  fund: FundOf | null;
  fundRows: FundLine[];
  today: string;
}

type Val = string | number | { f: string; v: number } | null | undefined;
interface Cell { s: string; inner: string; t: string }
interface Row { attrs: string; cells: Map<number, Cell> }
interface Tpl { h: string | undefined; cells: Map<number, string>; mg: Array<[string, string]> }

/** 칸 번호는 엑셀처럼 1부터 (A = 1) */
const colIndex = (l: string) => colIndex0(l) + 1;
const colLetter = (n: number) => colLetter0(n - 1);
const dec = new TextDecoder();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escA = (s: string) => esc(s).replace(/"/g, '&quot;');
const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const attr = (a: string, k: string) => a.match(new RegExp(`\\b${k}="([^"]*)"`))?.[1];
const num = (n: number) => (Number.isFinite(n) ? String(n) : '0');
const F = (f: string, v: number) => ({ f, v });
const resultOf = (v: Val) => (v && typeof v === 'object' ? v.v : typeof v === 'number' ? v : 0);

function cellXml(v: Val): Pick<Cell, 'inner' | 't'> {
  if (v == null || v === '') return { inner: '', t: '' };
  if (typeof v === 'number') return { inner: `<v>${num(v)}</v>`, t: '' };
  if (typeof v === 'string') return { inner: `<is><t xml:space="preserve">${esc(v)}</t></is>`, t: 'inlineStr' };
  return { inner: `<f>${esc(v.f)}</f><v>${num(v.v)}</v>`, t: '' };
}

/** 시트 XML → 줄 (sheetData 만) */
function parseRows(xml: string) {
  const i = xml.indexOf('<sheetData>');
  const j = xml.indexOf('</sheetData>');
  const rows = new Map<number, Row>();
  for (const m of xml.slice(i + 11, j).matchAll(/<row\b([^>]*?)(?:\/>|>(.*?)<\/row>)/gs)) {
    const r = +attr(m[1], 'r')!;
    const cells = new Map<number, Cell>();
    for (const c of (m[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
      const ref = attr(c[1], 'r')!;
      cells.set(colIndex(ref.replace(/\d+$/, '')), { s: attr(c[1], 's') ?? '', inner: c[2] ?? '', t: attr(c[1], 't') ?? '' });
    }
    rows.set(r, { attrs: m[1].replace(/\s*\br="\d+"/, '').replace(/\s*\bspans="[^"]*"/, ''), cells });
  }
  return { head: xml.slice(0, i), tail: xml.slice(j + 12), rows };
}
function rowsXml(rows: Map<number, Row>) {
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([r, row]) => {
    const cs = [...row.cells.entries()].sort((a, b) => a[0] - b[0])
      .map(([c, x]) => `<c r="${colLetter(c)}${r}"${x.s ? ` s="${x.s}"` : ''}${x.t ? ` t="${x.t}"` : ''}${x.inner ? `>${x.inner}</c>` : '/>'}`).join('');
    return `<row r="${r}"${row.attrs}${cs ? `>${cs}</row>` : '/>'}`;
  }).join('');
}
const setVal = (rows: Map<number, Row>, addr: string, v: Val, s?: string) => {
  const m = addr.match(/^([A-Z]+)(\d+)$/)!;
  const r = +m[2];
  const row = rows.get(r) ?? { attrs: '', cells: new Map() };
  rows.set(r, row);
  const c = colIndex(m[1]);
  const old = row.cells.get(c);
  row.cells.set(c, { s: s ?? old?.s ?? '', ...cellXml(v) });
};
/** 공유 글자 (sharedStrings) 읽기 — 틀의 옆 칸 이름 · Remarks 기본 문구 */
const sharedStrings = (xml: string) => xml.split('</si>').slice(0, -1).map((x) => unesc([...x.slice(x.indexOf('<si>') + 4).replace(/<rPh\b.*?<\/rPh>/gs, '').matchAll(/<t\b[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join('')));
const textOf = (c: Cell | undefined, sst: string[]) => (!c ? '' : c.t === 's' ? sst[+(c.inner.match(/<v>(\d+)<\/v>/)?.[1] ?? -1)] ?? '' : unesc(c.inner.replace(/<[^>]+>/g, '')));

/** 줄 높이 — 세부 내역 · 품목 이름 줄 수 (데모 hgt) */
const hgt = (it: PmQuoteItem) => {
  const L = String(it.desc || '').split(/\r?\n/).reduce((a, l) => a + Math.max(1, Math.ceil(l.length / 34)), 0);
  const N = String(it.name || '').split(/\r?\n/).length * 1.4;
  return Math.max(17.25, Math.min(409, Math.max(L, N) * 13 + 6));
};

export const quoteSheetName = (short: string) => `${short}(견적)`.replace(/[[\]:*?/\\']/g, '').slice(0, 31);
export const quoteFileName = (x: Pick<QuoteXlsxInput, 'company' | 'short' | 'q' | 'today'>) => `${String(x.company || x.short).replace(/[\\/:*?"<>|]/g, '')}_견적서_${x.q.date || x.today}.xlsx`;

export async function buildQuoteXlsx(tpl: Uint8Array, x: QuoteXlsxInput): Promise<Uint8Array> {
  const files = await unzip(tpl);
  const txt = (p: string) => dec.decode(files.get(p)!);
  const sst = sharedStrings(txt('xl/sharedStrings.xml'));
  const sheet = parseRows(txt('xl/worksheets/sheet2.xml'));
  const cover = parseRows(txt('xl/worksheets/sheet1.xml'));
  const q = x.q;
  const SN = quoteSheetName(x.short);
  const Q = (a: string) => `'${SN}'!${a}`;
  const tail0 = sheet.tail;
  const MG = [...tail0.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g)];
  const ws = sheet.rows;
  const cap = (r: number): Tpl => {
    const row = ws.get(r);
    const cells = new Map<number, string>();
    for (const [c, v] of row?.cells ?? []) if (c <= 23 && v.s) cells.set(c, v.s);
    return { h: row ? attr(row.attrs, 'ht') : undefined, cells, mg: MG.filter((m) => m[2] === String(r) && m[4] === String(r)).map((m) => [m[1], m[3]]) };
  };
  const T = { sec: cap(19), secHw: cap(24), sw: cap(20), hw: cap(25), etc: cap(36), sub: cap(23), sub2: cap(34), tot: cap(40), gap: cap(41), rmH: cap(43), rm: cap(44), fH: cap(53), f: cap(54) };
  const side = ['Q', 'R', 'S', 'T', 'U', 'V', 'W'];
  const sideLab = side.map((c) => textOf(ws.get(23)?.cells.get(colIndex(c)), sst));
  const rmT: string[] = [];
  for (let r = 44; r <= 52; r++) { const v = textOf(ws.get(r)?.cells.get(1), sst); if (v.trim()) rmT.push(v); }

  // 머리 부분 (1~18행은 틀 그대로, 값만 바꿈)
  const ser = q.date ? (Date.UTC(+q.date.slice(0, 4), +q.date.slice(5, 7) - 1, +q.date.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000 : null;
  setVal(ws, 'M5', ser);
  if (q.mgr) setVal(ws, 'M9', q.mgr);
  setVal(ws, 'A10', `견적번호 : ${q.no || ''}`);
  setVal(ws, 'A11', `수 신 : ${q.to || ''}`);
  setVal(ws, 'A12', `참 조 : ${q.ref || ''}${q.ref ? ' 貴下' : ''}`);
  setVal(ws, 'A13', `유효기간 : ${q.valid || ''}`);
  setVal(ws, 'A14', `지불조건 : ${q.pay || ''}`);
  setVal(ws, 'A16', `Project : ${q.proj || ''}`);
  // 틀의 옛 줄(19행~)과 칸 합치기를 비움
  for (const r of [...ws.keys()]) if (r >= 19) ws.delete(r);
  const merges: string[] = MG.filter((m) => +m[2] < 19).map((m) => `${m[1]}${m[2]}:${m[3]}${m[4]}`);

  let n = 19;
  const put = (t: Tpl, vals: Record<string, Val> = {}, h?: number) => {
    const cells = new Map<number, Cell>();
    for (const [c, s] of t.cells) cells.set(c, { s, inner: '', t: '' });
    const ht = h ?? (t.h ? +t.h : undefined);
    ws.set(n, { attrs: ht ? ` ht="${num(ht)}" customHeight="1"` : '', cells });
    for (const [a, v] of Object.entries(vals)) if (v != null && v !== '') setVal(ws, `${a}${n}`, v);
    for (const [a, b] of t.mg) merges.push(`${a}${n}:${b}${n}`);
    return n++;
  };
  const subs: number[] = [];
  const rowOf = new Map<PmQuoteItem, number>();
  const cat: Record<string, { rev: string[]; buy: string[]; bc: number; rv: number; bv: number }> = {};
  let total = 0;
  for (const [sec, title] of QT_SEC_TITLE) {
    const L = q.items.filter((it) => it.sec === sec);
    if (!L.length && sec !== 'sw') continue;
    const hw = sec === 'hw';
    const h0 = put(hw ? T.secHw : T.sec, { A: title });
    const a = n;
    for (const it of L) {
      const r = n;
      const amt = qAmt(it);
      const buy = qBuy(it);
      total += amt;
      const v: Record<string, Val> = { A: it.name, C: it.desc, I: qNum(it.qty), J: it.unit, K: qNum(it.price), M: F(`K${r}*I${r}`, amt), O: it.note };
      if (hw) Object.assign(v, { Q: F(`R${r}-S${r}`, amt - buy), R: F(`M${r}`, amt), S: F(`(U${r}-V${r})*T${r}`, buy), T: F(`I${r}`, qNum(it.qty)), U: qNum(it.cost), V: 0, W: F(`IFERROR(V${r}/(U${r}*T${r}),0)`, 0) });
      put(hw ? T.hw : sec === 'etc' ? T.etc : T.sw, v, hgt(it));
      rowOf.set(it, r);
      const c = (cat[it.cat] ??= { rev: [], buy: [], bc: 0, rv: 0, bv: 0 });
      c.rev.push(`M${r}`);
      if (hw) c.buy.push(`S${r}`); else c.bc += buy;
      c.rv += amt;
      c.bv += buy;
    }
    const b = n - 1;
    const st = L.reduce((s, it) => s + qAmt(it), 0);
    if (hw && L.length) {
      const sb = L.reduce((s, it) => s + qBuy(it), 0);
      const vals = [st - sb, st, sb, L.reduce((s, it) => s + qNum(it.qty), 0), L.reduce((s, it) => s + qNum(it.cost), 0)];
      ['Q', 'R', 'S', 'T', 'U'].forEach((c, i) => setVal(ws, `${c}${h0}`, F(`SUM(${c}${a}:${c}${b})`, vals[i])));
      setVal(ws, `W${h0}`, F(`IFERROR(1-(S${h0}/R${h0}),0)`, st ? 1 - sb / st : 0));
    }
    const sv: Record<string, Val> = { A: '소계 (VAT 별도)', K: F(L.length ? `SUM(M${a}:N${b})` : '0', st) };
    if (sec === 'sw') side.forEach((c, i) => { sv[c] = sideLab[i]; });
    subs.push(put(sec === 'sw' ? T.sub : T.sub2, sv));
  }
  const tr = put(T.tot, { A: '합계 1+2+3 (VAT 별도)', K: F(`SUM(${subs.map((r) => `K${r}`).join(',')})`, total) });
  setVal(ws, 'M10', F(`K${tr}`, total));
  put(T.gap); put(T.gap); put(T.rmH, { A: 'Remarks' });
  for (const l of String(q.remarks || '').trim() ? String(q.remarks).split(/\r?\n/).filter((s) => s.trim()).map((s) => ` ${s.trim()}`) : rmT) put(T.rm, { A: l });

  // 사업비 현황 — 화면의 qFundRows 와 같은 값. 정부지원금이 비율 계산이면 MIN 수식(상한), 확정 · 계획서 금액이면 숫자
  const ref: Record<string, number> = {};
  const fvals = new Map<number, Val>();
  if (x.kind === '정부지원' && x.fund) {
    put(T.gap); put(T.gap); put(T.fH, { A: '사업비 현황' });
    const Fd = x.fund;
    const R = x.fundRows;
    const g = Fd.rows.find((y) => y.key === 'gov');
    const r1 = n;
    const nOf = (l: string) => r1 + R.findIndex((y) => y.l === l);
    const exR = R.filter((y) => /^⑥/.test(y.l)).map((y) => nOf(y.l));
    for (const y of R) {
      let v: Val = y.v ?? 0;
      if (/^①/.test(y.l)) v = F(`F${nOf('② 구축금액')}+F${nOf('④ 인력지원금(현물)')}+F${nOf('⑤ 클라우드 지원금(현물)')}`, y.v ?? 0);
      else if (/^②/.test(y.l)) v = Fd.build === total ? F(`K${tr}`, y.v ?? 0) : y.v ?? 0;
      else if (/^③/.test(y.l) && g && !g.fromPlan && g.fix == null && g.rate != null) v = F(g.cap != null ? `MIN(F${r1}*${g.rate / 100},${g.cap})` : `F${r1}*${g.rate / 100}`, y.v ?? 0);
      else if (/^⑦/.test(y.l)) v = F(`F${r1}-F${nOf('③ 정부지원금')}-F${nOf('④ 인력지원금(현물)')}-F${nOf('⑤ 클라우드 지원금(현물)')}${exR.map((r) => `-F${r}`).join('')}`, y.v ?? 0);
      else if (/^⑧/.test(y.l)) v = F(`F${nOf('⑦ 도입기업 실제 자부담금')}`, y.v ?? 0);
      const r = put(T.f, { A: y.l, F: v, K: y.n.replace(/ · .*$/, '') });
      ref[y.l.slice(0, 1)] = r;
      fvals.set(r, v);
    }
  }
  const last = n - 1;

  // 표지: 분류별 매출 · 매입 · 이익 (엑셀 합계가 '기타' 칸까지 포함하도록 범위를 끝 칸까지)
  const cv = cover.rows;
  const sty = (addr: string) => { const m = addr.match(/^([A-Z]+)(\d+)$/)!; return cv.get(+m[2])?.cells.get(colIndex(m[1]))?.s ?? ''; };
  const st8: Record<number, { b: string; c: string; d: string }> = {};
  for (const r of [8, 9, 10, 11, 12]) st8[r] = { b: sty(`B${r}`), c: sty(`C${r}`), d: sty(`D${r}`) };
  for (let r = 8; r <= 12; r++) { const row = cv.get(r); if (row) for (let c = 2; c <= 26; c++) row.cells.delete(c); }
  const ord = ['MES개발비', '전처리', '경비', '설비', '디바이스', 'PLC', '네트워크'];
  const cats = [...ord, ...PL_CATS.filter((k) => !ord.includes(k) && k !== ETC_CAT && cat[k]), ETC_CAT];
  const col = (i: number) => colLetter(4 + i);
  const lastC = col(cats.length - 1);
  setVal(cv, 'B2', q.proj || `${x.company} 견적`);
  setVal(cv, 'B8', '구분', st8[8].b);
  setVal(cv, 'C8', '합계', st8[8].c);
  const res = new Map<string, number>();
  for (const [j, [lab, key, vk]] of ([['매출(원)', 'rev', 'rv'], ['매입(원)', 'buy', 'bv']] as const).entries()) {
    const r = 9 + j;
    const sumV = cats.reduce((a, k) => a + (cat[k]?.[vk] ?? 0), 0);
    setVal(cv, `B${r}`, lab, st8[r].b);
    setVal(cv, `C${r}`, F(`SUM(D${r}:${lastC}${r})`, sumV), st8[r].c);
    res.set(`C${r}`, sumV);
    cats.forEach((k, i) => {
      const y = cat[k];
      const parts = y ? [...y[key].map(Q), ...(key === 'buy' && y.bc ? [String(Math.round(y.bc))] : [])] : [];
      setVal(cv, `${col(i)}${r}`, parts.length ? F(parts.join('+'), y![vk]) : 0, st8[r].d);
      res.set(`${col(i)}${r}`, parts.length ? y![vk] : 0);
    });
  }
  cats.forEach((k, i) => setVal(cv, `${col(i)}8`, k === ETC_CAT ? '기타' : k, st8[8].d));
  for (const [lab, r] of [['이익(원)', 11], ['이익률(%)', 12]] as const) {
    setVal(cv, `B${r}`, lab, st8[r].b);
    for (const cc of ['C', ...cats.map((_, i) => col(i))]) {
      const a = res.get(`${cc}9`) ?? 0;
      const b = res.get(`${cc}10`) ?? 0;
      setVal(cv, `${cc}${r}`, r === 11 ? F(`${cc}9-${cc}10`, a - b) : F(`IFERROR((${cc}9-${cc}10)/${cc}9,0)`, a ? (a - b) / a : 0), cc === 'C' ? st8[r].c : st8[r].d);
    }
  }
  const itemRef = (re: RegExp): Val => { const it = q.items.find((y) => y.sec === 'etc' && re.test(y.name)); return it ? F(Q(`M${rowOf.get(it)}`), qAmt(it)) : 0; };
  const fv = (l: string): Val => (ref[l] ? F(Q(`F${ref[l]}`), resultOf(fvals.get(ref[l]))) : 0);
  const gov = x.kind === '정부지원';
  setVal(cv, 'B5', gov ? fv('①') : F('C5', total));
  setVal(cv, 'C5', gov ? fv('②') : F('C9', total));
  setVal(cv, 'D5', fv('④'));
  setVal(cv, 'E5', fv('⑤'));
  setVal(cv, 'F5', itemRef(/임치/));
  setVal(cv, 'G5', itemRef(/정산/));
  setVal(cv, 'H5', itemRef(/교육/));

  // ── XML 다시 묶기 ──
  const lastCol = 4 + cats.length - 1;
  let coverHead = cover.head;
  if (lastCol > 11) coverHead = coverHead.replace(/<col min="12" max="16384"[^>]*\/>/, `<col min="12" max="${lastCol}" width="17.08203125" style="1" customWidth="1"/><col min="${lastCol + 1}" max="16384" width="8.6640625" style="1"/>`);
  const sheetHead = sheet.head.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:W${last}"/>`);
  const sheetTail = tail0
    .replace(/<mergeCells\b.*?<\/mergeCells>/s, `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`)
    .replace(/<rowBreaks\b.*?<\/rowBreaks>/s, '');
  const out = new Map(files);
  out.set('xl/worksheets/sheet2.xml', new TextEncoder().encode(`${sheetHead}<sheetData>${rowsXml(ws)}</sheetData>${sheetTail}`));
  out.set('xl/worksheets/sheet1.xml', new TextEncoder().encode(`${coverHead}<sheetData>${rowsXml(cv)}</sheetData>${cover.tail}`));
  const oldName = txt('xl/workbook.xml').match(/<sheet name="([^"]*)" sheetId="2"/)?.[1] ?? '';
  const wb = txt('xl/workbook.xml')
    .replace(`<sheet name="${oldName}" sheetId="2"`, `<sheet name="${escA(SN)}" sheetId="2"`)
    .replace(/<definedName name="_xlnm\.Print_Area" localSheetId="1">[^<]*<\/definedName>/, `<definedName name="_xlnm.Print_Area" localSheetId="1">${esc(Q(`$A$1:$O$${last}`))}</definedName>`)
    .replace(/<calcPr\b([^>]*?)\/>/, (_m, a: string) => `<calcPr${a.replace(/\s*fullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"/>`);
  out.set('xl/workbook.xml', new TextEncoder().encode(wb));
  // 계산 순서 기록(calcChain)은 옛 줄을 가리켜 엑셀이 '복구'를 묻게 되므로 뺌 (열 때 전체 다시 계산)
  out.delete('xl/calcChain.xml');
  out.set('xl/_rels/workbook.xml.rels', new TextEncoder().encode(txt('xl/_rels/workbook.xml.rels').replace(/<Relationship [^>]*calcChain[^>]*\/>/, '')));
  out.set('[Content_Types].xml', new TextEncoder().encode(txt('[Content_Types].xml').replace(/<Override PartName="\/xl\/calcChain\.xml"[^>]*\/>/, '')));
  out.set('xl/sharedStrings.xml', new TextEncoder().encode(txt('xl/sharedStrings.xml').replace(/\s*\bcount="\d+"/, '')));
  if (oldName) out.set('docProps/app.xml', new TextEncoder().encode(txt('docProps/app.xml').split(esc(oldName)).join(esc(SN))));
  return zip([...out.entries()]);
}
