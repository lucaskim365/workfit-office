/**
 * 일일 업무 보고 PDF (데모 pdfPage · pdfOpen 5440~) — 회사 양식(업무보고일지)과 같은 모양으로 인쇄 창을 열고
 * 사용자가 'PDF로 저장'을 고른다. 창 제목이 저장 파일 이름이 된다 (팀명+이름_YYMMDD).
 */
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** 한 사람 한 장 (rows: [업무 내용, 비고, 진행상태]) — 개인 PDF와 팀 PDF가 같이 씀 */
export const pdfPage = (date: string, dept: string, name: string, rows: ReadonlyArray<readonly [string, string, string]>) => `<section class="pg">
    <div class="ttl">일일업무보고</div>
    <table class="info"><tr><td class="k" style="width:10%">일자</td><td class="v" style="width:26%">${esc(date)}</td><td class="k" style="width:14%">부서</td><td class="v" style="width:27%">${esc(dept)}</td><td class="k" style="width:12%">작성자</td><td class="v">${esc(name)}</td></tr></table>
    <div class="sec">업무 수행 내역</div>
    <table class="list"><tr><th style="width:7%">순번</th><th style="width:28%">업무 내용</th><th style="width:53%">비고</th><th>진행상태</th></tr>${rows.map((r, i) => `<tr><td class="c">${i + 1}</td><td class="c">${esc(r[0])}</td><td>${esc(r[1])}</td><td class="r">${esc(r[2])}</td></tr>`).join('') || '<tr><td class="c" colspan="4">작성한 업무계획이 없습니다</td></tr>'}</table></section>`;

/** 인쇄 창 열기 — 팝업이 막히면 false */
export function pdfOpen(title: string, pages: readonly string[]): boolean {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page{size:A4;margin:18mm 14mm}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{margin:0;font-family:'Malgun Gothic','맑은 고딕',sans-serif;color:#222;font-size:10.5pt}
    .pg + .pg{page-break-before:always}
    .ttl{background:#1b365d;color:#fff;text-align:center;font-size:19pt;font-weight:700;letter-spacing:.75em;padding:9px 0 9px .75em}
    table{width:100%;border-collapse:collapse}
    .info{margin:14px 0 26px}.info td{border:1px solid #9bb3cf;height:24px;text-align:center;font-size:9.5pt}
    .info .k{background:#dce6f1;font-weight:700;color:#1b365d}.info .v{background:#fffcf3}
    .sec{background:#1b365d;color:#fff;font-weight:700;font-size:10pt;padding:6px 4px}
    .list td,.list th{border:1px solid #222;height:30px;font-size:9.5pt;padding:5px 6px;line-height:1.45;word-break:keep-all;overflow-wrap:anywhere}
    .list tr{page-break-inside:avoid}
    .list th{background:#dce6f1;color:#1b365d;height:26px}
    .list tr:nth-child(odd) td{background:#f3f7fb}
    .c{text-align:center}.r{text-align:right}
  </style></head><body>${pages.join('')}</body></html>`;
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onafterprint = () => w.close();
  setTimeout(() => { w.focus(); w.print(); }, 300);
  return true;
}

/** 클립보드 복사 — 막히면 숨은 입력칸으로 (copyText) */
export async function copyText(txt: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); return true; }
  } catch { /* 아래 방법으로 */ }
  const ta = document.createElement('textarea');
  ta.value = txt;
  ta.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}
