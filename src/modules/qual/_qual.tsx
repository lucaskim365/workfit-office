import type { ReactNode } from 'react';

/** 품질관리 화면 공통 색 토큰 (SVG·data 인라인용). */
export const C = {
  ink: '#1c2536', ink2: '#56607a', ink3: '#8b95ab',
  navy: '#1f2f55', teal: '#17a89a', tealSoft: '#dcf3f0',
  ok: '#16a34a', okSoft: '#e7f5ee', warn: '#e6960c', err: '#e0483b',
  blue: '#3a6ee0', blueSoft: '#e7eefc', amber: '#ef8f43', violet: '#8b6fd6',
  bgDeep: '#e6eaf2', border: '#e3e8f0', borderHi: '#d4dbe7', panelAlt: '#f7f9fc',
};

/** 조회용 코스메틱 셀렉트(표시 전용). */
export function Sel({ value, w }: { value?: string; w?: number }) {
  return (
    <span
      className="inline-flex items-center justify-between gap-3.5 rounded-[7px] border border-border-hi bg-panel px-3 py-[7px] text-[11.5px] font-semibold whitespace-nowrap"
      style={{ minWidth: w || 100, color: value ? C.ink : C.ink3 }}
    >
      {value || '전체'} <span className="text-[8px] text-ink3">▾</span>
    </span>
  );
}

/** 흰 배경 필터 바. */
export function FilterCard({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-border bg-panel p-3.5">{children}</div>;
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-ink3">{label}</span>
      {children}
    </span>
  );
}

/** 칩 토글 그룹. */
export function ChipTabs({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {items.map((g) => {
        const on = value === g;
        return (
          <button key={g} onClick={() => onChange(g)} className="rounded-[7px] px-2.5 py-1.5 text-[11px] font-bold" style={{ border: `1px solid ${on ? C.teal : C.borderHi}`, background: on ? C.tealSoft : '#fff', color: on ? C.teal : C.ink2 }}>{g}</button>
        );
      })}
    </div>
  );
}

export type KpiItem = [label: string, value: string, unit: string, color: string];

/** KPI 카드 그리드. */
export function KpiGrid({ items, cols = 5 }: { items: KpiItem[]; cols?: number }) {
  const colCls: Record<number, string> = {
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6',
  };
  return (
    <div className={`grid gap-3 ${colCls[cols] || colCls[5]}`}>
      {items.map(([l, v, u, c]) => (
        <div key={l} className="rounded-[11px] border border-border bg-panel px-4 py-3.5">
          <div className="mb-1.5 whitespace-nowrap text-[10.5px] font-semibold text-ink3">{l}</div>
          <div className="flex items-baseline gap-1">
            <span className="whitespace-nowrap text-[23px] font-extrabold tracking-tight tabular-nums" style={{ color: c }}>{v}</span>
            <span className="text-[11px] font-semibold text-ink3">{u}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** 검색 입력 박스. */
export function SearchBox({ value, onChange, placeholder, w = 110 }: { value: string; onChange: (v: string) => void; placeholder?: string; w?: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-[7px] border border-border-hi bg-panel px-2.5 py-1.5">
      <span className="text-[11px] text-ink3">⌕</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="bg-transparent text-[11px] text-ink outline-none" style={{ width: w }} />
    </div>
  );
}

export const won = (n: number) => n.toLocaleString('ko-KR');
