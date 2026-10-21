import type { ReactNode } from 'react';

/** PWA 프로필 화면 공용 부품 — 카드 한 장이 웹 프로필 설정의 구역 하나에 해당한다. */
export function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/80 bg-white p-4 shadow-2xs">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-4 w-1 rounded-sm bg-teal" />
        <h2 className="text-[13.5px] font-extrabold text-ink">{title}</h2>
        {hint && <span className="min-w-0 truncate text-[10.5px] text-ink3">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** 저장 결과 한 줄 — 성공은 청록, 실패는 빨강. */
export function Feedback({ msg, err }: { msg?: string; err?: string }) {
  if (err) return <p role="alert" className="text-[11.5px] font-semibold text-rose-600">{err}</p>;
  if (msg) return <p className="text-[11.5px] font-semibold text-teal">{msg}</p>;
  return null;
}

export const inputClass = 'mt-1 h-10 w-full min-w-0 rounded-xl border border-border bg-panel px-3 text-[13px] font-normal text-ink outline-none focus:border-teal disabled:opacity-50';
export const labelClass = 'block min-w-0 text-[12px] font-bold text-ink2';
export const saveButton = 'w-full rounded-xl bg-teal py-2.5 text-[12.5px] font-bold text-white disabled:opacity-50';
export const outlineButton = 'rounded-xl border border-border bg-white px-3.5 py-2 text-[12px] font-bold text-ink2 disabled:opacity-50';
export const dangerOutlineButton = 'rounded-xl border border-rose-500/30 bg-white px-3.5 py-2 text-[12px] font-bold text-rose-600 disabled:opacity-50';
