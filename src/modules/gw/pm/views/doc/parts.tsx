import type { ReactNode } from 'react';
import { DOC_ST, type DocSt } from '@/domain/pm/doc';

/**
 * 산출물 작은 부품 (데모 adr-seg · wPager) — PM 전용 (§3.2.2).
 */

/** 산출물 상태 3칸 [미작성 | 작성중 | 제출] (adr-seg, docSet3) */
export function DocSeg({ st, onSet, disabled }: { st: DocSt; onSet: (v: DocSt) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex flex-none overflow-hidden rounded-md border border-border-hi" role="group" aria-label="산출물 상태">
      {DOC_ST.map((v) => {
        const on = st === v;
        const tone = v === '제출완료' ? 'bg-ok text-white' : v === '작성중' ? 'bg-blue text-white' : 'bg-ink3 text-white';
        return (
          <button key={v} type="button" disabled={disabled} onClick={() => !on && onSet(v)} aria-pressed={on}
            className={`border-l border-border-hi px-2.5 py-1 text-[11.5px] font-bold first:border-l-0 ${on ? tone : 'bg-panel text-ink2 hover:bg-panel-alt'}`}>
            {v === '제출완료' ? '제출' : v}
          </button>
        );
      })}
    </div>
  );
}

/** 쪽 넘김 (wPager) — 1 · 끝 · 지금 앞뒤 2쪽, 사이는 … */
export function Pager({ n, cur, onGo }: { n: number; cur: number; onGo: (p: number) => void }) {
  if (n < 2) return null;
  const arr = [...new Set([1, n, cur - 2, cur - 1, cur, cur + 1, cur + 2].filter((i) => i >= 1 && i <= n))].sort((a, b) => a - b);
  const btn = 'rounded border border-border-hi px-2 py-0.5 text-[11.5px]';
  const out: ReactNode[] = [];
  let prev = 0;
  for (const i of arr) {
    if (i - prev > 1) out.push(<span key={`g${i}`} className="text-ink3">…</span>);
    out.push(<button key={i} type="button" onClick={() => onGo(i)} className={`${btn} ${i === cur ? 'bg-blue-soft font-bold text-blue' : 'bg-panel text-ink2'}`}>{i}</button>);
    prev = i;
  }
  return (
    <div className="flex items-center justify-center gap-1 border-t border-border py-2.5">
      {cur > 1 && <button type="button" className={`${btn} bg-panel text-ink2`} onClick={() => onGo(cur - 1)}>‹ 이전</button>}
      {out}
      {cur < n && <button type="button" className={`${btn} bg-panel text-ink2`} onClick={() => onGo(cur + 1)}>다음 ›</button>}
    </div>
  );
}
