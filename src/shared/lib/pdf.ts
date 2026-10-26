/**
 * 화면 요소 → A4 PDF 다운로드.
 *
 * 요소를 이미지로 떠서 A4 세로 페이지에 나눠 붙인다. 글꼴을 PDF에 심을 필요가 없어 한글이
 * 깨지지 않는다(대신 글자 선택은 안 된다). 라이브러리는 PDF를 만들 때만 불러온다.
 *
 * - html2canvas-pro: Tailwind v4 의 oklch 색을 읽는다(원본 html2canvas 는 oklch 에서 멈춘다).
 * - 인쇄 전용 숨김(`print:hidden`)은 화면 캡처에도 빼서 인쇄본과 같게 만든다.
 * - 앱 화면 배율(body zoom)은 캡처 도구가 처리하지 못해 글자 위치가 어긋나므로, 캡처 사본에서는 1로 되돌린다.
 * - 페이지는 표 행·이미지 중간에서 자르지 않는다(그 위에서 다음 장으로 넘김).
 */
const A4_W = 210;
const A4_H = 297;
const MARGIN = 10;

/** 이미지가 다 그려질 때까지 기다린다 — 도장·서명이 빠진 PDF가 나오지 않게. */
async function waitForImages(el: HTMLElement): Promise<void> {
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
    ),
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** 다른 서버의 그림(직인·도장)을 미리 받아 data URL 로 — 캡처 도구가 다른 주소 그림을 빼먹지 않게. 실패하면 원래 주소 유지 */
async function inlineImageSources(el: HTMLElement): Promise<Map<string, string>> {
  const srcs = new Set(
    Array.from(el.querySelectorAll('img'))
      .map((img) => img.currentSrc || img.src)
      .filter((src) => /^https?:/.test(src) && !src.startsWith(window.location.origin)),
  );
  const out = new Map<string, string>();
  await Promise.all(
    [...srcs].map(async (src) => {
      try {
        // no-store — 화면 <img> 가 CORS 없이 받아 둔 캐시(허용 헤더 없음)를 다시 쓰면 CORS 오류로 직인이 빠진다.
        //   파일 서버는 Origin 이 있을 때만 허용 헤더를 붙이고 Vary: Origin 을 주지 않으므로 캐시를 건너뛰고 새로 받는다.
        const res = await fetch(src, { mode: 'cors', cache: 'no-store' });
        if (res.ok) out.set(src, await blobToDataUrl(await res.blob()));
      } catch {
        /* 받지 못하면 캡처 도구의 useCORS 에 맡긴다 */
      }
    }),
  );
  return out;
}

/**
 * 페이지를 나눌 위치(요소 높이 대비 비율 0~1). 한 장 높이(pageRatio)를 넘지 않게 자르되,
 * 표 행·이미지·print-avoid-break 블록이 걸리면 그 블록 위에서 자른다(블록이 한 장보다 크면 그냥 자름).
 */
export function pageBreaks(blocks: Array<[number, number]>, pageRatio: number): number[] {
  const breaks: number[] = [];
  let start = 0;
  while (start + pageRatio < 1 - 1e-9) {
    let cut = start + pageRatio;
    for (const [top, bottom] of blocks) {
      if (top < cut && bottom > cut && top > start + 1e-9 && bottom - top <= pageRatio) cut = Math.min(cut, top);
    }
    breaks.push(cut);
    start = cut;
  }
  return breaks;
}

/** 자르면 안 되는 블록들의 위·아래 위치(요소 높이 대비 비율) — 배율과 상관없이 비율로 잰다 */
function unbreakableBlocks(el: HTMLElement): Array<[number, number]> {
  const box = el.getBoundingClientRect();
  if (box.height <= 0) return [];
  return Array.from(el.querySelectorAll<HTMLElement>('tr, img, .print-avoid-break')).map((n) => {
    const r = n.getBoundingClientRect();
    return [(r.top - box.top) / box.height, (r.bottom - box.top) / box.height] as [number, number];
  });
}

export async function exportElementToPdf(el: HTMLElement, fileName: string): Promise<void> {
  await document.fonts?.ready;
  await waitForImages(el);
  const inlined = await inlineImageSources(el);
  const blocks = unbreakableBlocks(el);

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    ignoreElements: (node) => node instanceof HTMLElement && node.classList.contains('print:hidden'),
    onclone: async (cloned, clonedEl) => {
      cloned.documentElement.style.zoom = '1';
      cloned.body.style.zoom = '1';
      // 캡처 도구는 글자 간격이 0이면 낱말 단위로 그려, 줄바꿈된 낱말을 앞 줄 맨 앞에 겹쳐 그린다.
      // 눈에 안 보이는 간격을 주면 글자 하나씩 자리를 재서 그린다(표 칸 여러 줄 글자 깨짐 방지).
      const view = cloned.defaultView;
      [clonedEl, ...Array.from(clonedEl.querySelectorAll<HTMLElement>('*'))].forEach((node) => {
        const ls = view?.getComputedStyle(node).letterSpacing;
        if (ls === 'normal' || ls === '0px') node.style.letterSpacing = '0.01px';
      });
      const imgs = Array.from(clonedEl.querySelectorAll('img'));
      imgs.forEach((img) => {
        const data = inlined.get(img.currentSrc || img.src);
        if (data) img.src = data;
      });
      await waitForImages(clonedEl);
    },
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const imgW = A4_W - MARGIN * 2;
  const pageContentH = A4_H - MARGIN * 2;
  /** 캔버스 px → mm 비율. 페이지 하나에 들어가는 캔버스 높이(px)를 구한다. */
  const pxPerMm = canvas.width / imgW;
  const pageRatio = (pageContentH * pxPerMm) / canvas.height;
  const cuts = [0, ...pageBreaks(blocks, pageRatio).map((b) => Math.round(b * canvas.height)), canvas.height];

  for (let page = 0; page < cuts.length - 1; page++) {
    const y = cuts[page];
    const h = cuts[page + 1] - y;
    if (h <= 0) continue;
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = h;
    slice.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (page > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, MARGIN, imgW, h / pxPerMm);
  }

  // pdf.save() 는 환경에 따라 파일명을 잃는다 — Blob 을 받아 직접 내려준다.
  const url = URL.createObjectURL(pdf.output('blob'));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
