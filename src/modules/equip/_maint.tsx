import type { ReactNode } from 'react';

/** 보전·점검 화면 공통 색 토큰 (SVG·data 인라인용). */
export const C = {
  ink: '#1c2536', ink2: '#56607a', ink3: '#8b95ab',
  navy: '#1f2f55', teal: '#17a89a', tealSoft: '#dcf3f0',
  ok: '#16a34a', okSoft: '#e7f5ee', warn: '#e6960c', err: '#e0483b',
  blue: '#3a6ee0', amber: '#ef8f43', violet: '#8b6fd6',
  bgDeep: '#e6eaf2', border: '#e3e8f0', borderHi: '#d4dbe7', panelAlt: '#f7f9fc',
};

/** 조회용 코스메틱 셀렉트(표시 전용). */
export function Sel({ value, w }: { value?: string; w?: number }) {
  return (
    <span
      className="inline-flex items-center justify-between gap-3.5 rounded-[7px] border border-border-hi bg-panel px-3 py-[7px] text-[11.5px] font-semibold"
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

export type KpiItem = [label: string, value: string, unit: string, color: string];

/** KPI 카드 그리드. */
export function KpiGrid({ items, cols = 5 }: { items: KpiItem[]; cols?: number }) {
  const colCls: Record<number, string> = {
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

export type Step = [title: string, time: string, desc: string, state: 'done' | 'active' | 'wait'];

/** 세로 진행 타임라인(접수→완료 워크플로우). */
export function Timeline({ steps }: { steps: Step[] }) {
  return (
    <div className="flex flex-col">
      {steps.map((f, i) => {
        const c = f[3] === 'done' ? C.ok : f[3] === 'active' ? C.teal : C.borderHi;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2" style={{ background: f[3] === 'wait' ? '#fff' : c, borderColor: c }}>
                {f[3] === 'done' && <span className="text-[9px] font-black text-white">✓</span>}
                {f[3] === 'active' && <span className="h-[5px] w-[5px] rounded-full bg-white" />}
              </span>
              {i < steps.length - 1 && <span className="w-0.5 flex-1" style={{ minHeight: 24, background: f[3] === 'done' ? C.ok : C.border }} />}
            </div>
            <div className="flex-1 pb-3.5">
              <div className="flex items-center justify-between">
                <span className={`text-[12px] font-bold ${f[3] === 'wait' ? 'text-ink3' : 'text-ink'}`}>{f[0]}</span>
                <span className="font-mono text-[10px] text-ink3">{f[1]}</span>
              </div>
              <div className="mt-0.5 text-[10.5px] text-ink3">{f[2]}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const won = (n: number) => n.toLocaleString('ko-KR');
