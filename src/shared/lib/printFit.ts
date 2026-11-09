import { useEffect, type RefObject } from 'react';

/**
 * 결재 문서 인쇄 맞춤 — 인쇄하는 동안 문서를 A4 폭에 꽉 채워, 문서 기본 글자(12px)가 9pt 로 찍히게 한다.
 * 둘째 장이 조금(20% 미만)만 넘치면 한 장에 넣는다: ① 간격·줄 간격을 좁히고 ② 그래도 넘치면 글자를 8pt 까지만 줄인다.
 * 그래도 안 들어가면 손대지 않고 여러 장으로 찍는다.
 *
 * 화면 배율(body zoom)이 인쇄에도 걸려 사람마다 인쇄 크기가 달랐다 — 인쇄 중에는 배율을 1로 둔다(index.css `html.print-fit`).
 * 맞춤 규칙은 화면에도 걸리게 해 두어(인쇄 창이 떠 있는 동안만) 인쇄 직전에 실제 높이를 잴 수 있다.
 */

const MM = 96 / 25.4;
/** A4(210×297mm) − 여백 14mm×2 (index.css @page) */
export const PAGE_W_PX = (210 - 28) * MM;
/** 반올림·브라우저 오차로 한 줄이 넘어가지 않게 조금 덜 쓴다 */
export const PAGE_H_PX = (297 - 28) * MM * 0.985;
/** 둘째 장이 이 비율 미만이면 한 장에 넣어 본다 */
export const MAX_OVERFLOW = 0.2;

export interface PrintFitLevel {
  /** 간격·줄 간격 좁히기 */
  compact: boolean;
  /** 글자 배율 — 1 = 9pt, 8/9 = 8pt */
  zoom: number;
}

/** 시도 순서: 그대로 → 간격 좁히기 → 간격 좁히기 + 8pt */
export const PRINT_FIT_LEVELS: PrintFitLevel[] = [
  { compact: false, zoom: 1 },
  { compact: true, zoom: 1 },
  { compact: true, zoom: 8 / 9 },
];

/**
 * 고를 단계. pagesOf(i) = i 단계로 찍었을 때 장 수(1 = 꼭 한 장).
 * 그대로 한 장이거나 둘째 장이 20% 이상이면 0(그대로), 아니면 한 장에 들어가는 첫 단계, 없으면 0.
 */
export function choosePrintFitLevel(pagesOf: (level: number) => number, levels = PRINT_FIT_LEVELS.length): number {
  const p0 = pagesOf(0);
  if (!(p0 > 1) || p0 >= 1 + MAX_OVERFLOW) return 0;
  for (let i = 1; i < levels; i++) if (pagesOf(i) <= 1) return i;
  return 0;
}

/** 단계를 문서에 건다 — 폭은 글자 배율로 나눠 넓혀, 찍히는 폭은 늘 A4 폭 */
function applyLevel(el: HTMLElement, level: PrintFitLevel) {
  el.setAttribute('data-print-fit', level.compact ? 'compact' : '');
  el.style.setProperty('--print-fit-zoom', String(level.zoom));
  el.style.setProperty('--print-fit-width', `${PAGE_W_PX / level.zoom}px`);
}

/** 지금 걸린 단계로 찍었을 때 장 수 — 높이÷폭 비율이라 화면 배율과 상관없다 */
function measurePages(el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  return r.width > 0 ? (PAGE_W_PX * (r.height / r.width)) / PAGE_H_PX : 0;
}

/** 인쇄 직전(beforeprint)에 단계를 골라 걸고, 인쇄가 끝나면(afterprint) 되돌린다 */
export function usePrintFit(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const after = () => {
      const el = ref.current;
      el?.removeAttribute('data-print-fit');
      el?.style.removeProperty('--print-fit-zoom');
      el?.style.removeProperty('--print-fit-width');
      document.documentElement.classList.remove('print-fit');
    };
    const before = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return; // 숨겨 둔 문서(PDF 만들기용 등)는 건드리지 않는다
      document.documentElement.classList.add('print-fit');
      const chosen = choosePrintFitLevel((i) => {
        applyLevel(el, PRINT_FIT_LEVELS[i]);
        return measurePages(el);
      });
      applyLevel(el, PRINT_FIT_LEVELS[chosen]);
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
