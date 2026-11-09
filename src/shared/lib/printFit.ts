import { useEffect, type RefObject } from 'react';

/**
 * 결재 문서 인쇄 맞춤 — 인쇄하는 동안만 문서를 화면 모양(폭 800px) 그대로 A4 폭에 맞춰 줄이고,
 * 둘째 장이 조금(기본 20% 미만)만 넘치면 한 장에 들어가게 더 줄인다.
 *
 * 화면 배율(body zoom)이 인쇄에도 걸려 사람마다 인쇄 크기·줄바꿈이 달랐다 — 맞춤 중에는 배율을 1로 둔다(index.css `html.print-fit`).
 */

/** 문서 화면 폭(px) — ApprovalDocumentView 의 w-[800px] */
export const DOC_WIDTH_PX = 800;
const MM = 96 / 25.4;
/** A4(210×297mm) − 여백 14mm×2 (index.css @page) */
export const PAGE_W_PX = (210 - 28) * MM;
/** 반올림·브라우저 오차로 한 줄이 넘어가지 않게 조금 덜 쓴다 */
export const PAGE_H_PX = (297 - 28) * MM * 0.985;

/**
 * 인쇄 배율. heightRatio = 문서 높이 ÷ 폭(화면 배율과 상관없는 비율).
 * 폭 맞춤으로 (1 + maxOverflow) 장 이하이면 한 장에 들어가는 배율, 그보다 길면 폭 맞춤 배율(여러 장).
 */
export function printFitZoom(heightRatio: number, maxOverflow = 0.2): number {
  const base = PAGE_W_PX / DOC_WIDTH_PX;
  const h = DOC_WIDTH_PX * heightRatio;
  if (!(h > 0)) return base;
  if (h * base <= PAGE_H_PX * (1 + maxOverflow)) return Math.min(base, PAGE_H_PX / h);
  return base;
}

/** 인쇄 직전(beforeprint)에 문서 높이를 재서 맞춤 배율을 걸고, 인쇄가 끝나면(afterprint) 되돌린다 */
export function usePrintFit(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const before = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return; // 숨겨 둔 문서(PDF 만들기용 등)는 건드리지 않는다
      el.style.setProperty('--print-fit-zoom', String(printFitZoom(r.height / r.width)));
      el.setAttribute('data-print-fit', '');
      document.documentElement.classList.add('print-fit');
    };
    const after = () => {
      const el = ref.current;
      el?.removeAttribute('data-print-fit');
      el?.style.removeProperty('--print-fit-zoom');
      document.documentElement.classList.remove('print-fit');
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      after();
    };
  }, [ref]);
}
