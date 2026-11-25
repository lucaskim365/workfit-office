import { unzip } from '@/lib/sheet/zip';

/**
 * 엑셀 파일 → 비교용 요약 (시트마다 칸 값 · 수식, 줄 높이, 칸 합치기, 인쇄 범위) — 견적서 내보내기 테스트용 (6-5).
 * 데모(ExcelJS)가 만든 엑셀과 이관 코드가 만든 엑셀을 같은 모양으로 읽어 비교한다. 모양 번호(s)는 ExcelJS 가 다시 매겨서 비교하지 않음.
 */
export interface XlsxDigest {
  sheets: string[];
  printArea: string;
  cells: Record<string, Record<string, [string, string | number]>>;
  heights: Record<string, Record<string, number>>;
  merges: Record<string, string[]>;
}
/** XML 글자 풀기 — 줄바꿈 CR LF 는 XML 규칙대로 LF 하나 */
const unesc = (s: string) => s.replace(/\r\n?/g, '\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const attr = (a: string, k: string) => a.match(new RegExp(`\\b${k}="([^"]*)"`))?.[1];

export async function xlsxDigest(bytes: Uint8Array): Promise<XlsxDigest> {
  const files = await unzip(bytes);
  const dec = new TextDecoder();
  const txt = (p: string) => dec.decode(files.get(p)!);
  const wb = txt('xl/workbook.xml');
  const rels = txt('xl/_rels/workbook.xml.rels');
  const sstXml = files.has('xl/sharedStrings.xml') ? txt('xl/sharedStrings.xml') : '';
  const sst = sstXml.split('</si>').slice(0, -1).map((x) => unesc([...x.slice(x.indexOf('<si>') + 4).replace(/<rPh\b.*?<\/rPh>/gs, '').matchAll(/<t\b[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join('')));
  const out: XlsxDigest = { sheets: [], printArea: unesc(wb.match(/<definedName name="_xlnm\.Print_Area"[^>]*>([^<]*)</)?.[1] ?? ''), cells: {}, heights: {}, merges: {} };
  for (const m of wb.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const name = unesc(attr(m[1], 'name')!);
    const rid = attr(m[1], 'r:id')!;
    const target = rels.match(new RegExp(`<Relationship [^>]*Id="${rid}"[^>]*Target="([^"]*)"`))?.[1] ?? rels.match(new RegExp(`<Relationship [^>]*Target="([^"]*)"[^>]*Id="${rid}"`))?.[1];
    const xml = txt(`xl/${target!.replace(/^\/?xl\//, '')}`);
    out.sheets.push(name);
    const cells: XlsxDigest['cells'][string] = {};
    const heights: Record<string, number> = {};
    for (const r of xml.matchAll(/<row\b([^>]*?)(?:\/>|>(.*?)<\/row>)/gs)) {
      const ht = attr(r[1], 'ht');
      if (ht) heights[attr(r[1], 'r')!] = +ht;
      for (const c of (r[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
        const inner = c[2] ?? '';
        const t = attr(c[1], 't');
        const f = inner.match(/<f\b[^>]*>(.*?)<\/f>/s)?.[1];
        const v = inner.match(/<v>(.*?)<\/v>/s)?.[1];
        const is = inner.match(/<is>(.*?)<\/is>/s)?.[1];
        let val: string | number | undefined;
        if (t === 's' && v != null) val = sst[+v];
        else if (t === 'inlineStr' && is != null) val = unesc([...is.matchAll(/<t\b[^>]*>(.*?)<\/t>/gs)].map((x) => x[1]).join(''));
        else if (t === 'str' && v != null) val = unesc(v);
        else if (v != null) val = +v;
        if (f == null && val == null) continue;
        cells[attr(c[1], 'r')!] = [f == null ? '' : unesc(f), val ?? ''];
      }
    }
    out.cells[name] = cells;
    out.heights[name] = heights;
    out.merges[name] = [...xml.matchAll(/<mergeCell ref="([^"]*)"\/>/g)].map((x) => x[1]).sort();
  }
  return out;
}
