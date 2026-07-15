import type { ReactNode } from 'react';
import { Card } from '@/shared/ui/Card';

/** 자재관리/영업/리포트 화면 공통 색 토큰. */
export const C = {
  ink: '#1c2536', ink2: '#56607a', ink3: '#8b95ab',
  navy: '#1f2f55', teal: '#17a89a', tealSoft: '#dcf3f0',
  ok: '#16a34a', okSoft: '#e7f5ee', warn: '#e6960c', err: '#e0483b',
  blue: '#3a6ee0', blueSoft: '#e7eefc', amber: '#ef8f43', violet: '#8b6fd6',
  bgDeep: '#e6eaf2', border: '#e3e8f0', borderHi: '#d4dbe7', panelAlt: '#f7f9fc',
};
const KTONE: Record<string, string> = { ink: C.ink, teal: C.teal, blue: C.blue, amber: C.amber, err: C.err, ok: C.ok, warn: C.warn };

/** 화면 헤더 — 자재관리 / {sub}. */
export function MHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">{title}</h1>
        <p className="mt-0.5 whitespace-nowrap text-xs text-ink3">자재관리 / {sub || title}</p>
      </div>
      {actions}
    </div>
  );
}

export type Kpi = [label: string, value: string, unit?: string, tone?: string];
/** KPI 카드 그리드(개수에 맞춰 균등 분할). */
export function MKpis({ items }: { items: Kpi[] }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
      {items.map(([l, v, u, tone]) => (
        <div key={l} className="rounded-[11px] border border-border bg-panel px-4 py-3.5">
          <div className="mb-1.5 whitespace-nowrap text-[11px] font-semibold text-ink2">{l}</div>
          <div className="flex items-baseline gap-1">
            <span className="whitespace-nowrap text-[23px] font-extrabold tracking-tight tabular-nums" style={{ color: KTONE[tone || 'ink'] }}>{v}</span>
            {u && <span className="text-[11px] font-semibold text-ink3">{u}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 조회용 코스메틱 셀렉트. */
export function FSel({ value, w }: { value?: string; w?: number }) {
  return (
    <span className="inline-flex items-center justify-between gap-3.5 rounded-md border border-border-hi bg-panel px-3 py-1.5 text-[11.5px] font-semibold whitespace-nowrap" style={{ minWidth: w || 110, color: value ? C.ink : C.ink3 }}>
      {value || '전체'} <span className="text-[8px] text-ink3">▾</span>
    </span>
  );
}

/** 조회용 코스메틱 입력. */
export function FInput({ ph, w }: { ph: string; w?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border-hi bg-panel px-3 py-1.5 text-[11.5px] text-ink3" style={{ minWidth: w || 140 }}>
      <span className="text-[11px]">⌕</span>{ph}
    </span>
  );
}

export function FField({ label, children }: { label: string; children: ReactNode }) {
  return <span className="flex items-center gap-2"><span className="text-[11px] font-semibold text-ink3">{label}</span>{children}</span>;
}

/** 흰 배경 필터 바. */
export function FBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-panel px-3.5 py-3">{children}</div>;
}

/** 색 지정 진행 막대. */
export function Bar({ v, color, w }: { v: number; color?: string; w?: number }) {
  const pct = Math.min(v, 100);
  const c = color || (pct >= 90 ? C.teal : pct >= 60 ? C.blue : C.warn);
  return (
    <div className="flex items-center gap-2" style={{ minWidth: w || 80 }}>
      <div className="h-[7px] flex-1 rounded" style={{ background: C.bgDeep }}><div className="h-full rounded" style={{ width: `${pct}%`, background: c }} /></div>
      <span className="w-8 text-right text-[10.5px] font-bold tabular-nums text-ink2">{Math.round(v)}%</span>
    </div>
  );
}

const AL: Record<string, string> = { right: 'text-right', center: 'text-center', left: 'text-left' };
export const th = (al: string) => `border-b border-border bg-panel-alt px-3 py-2 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${AL[al] || 'text-left'}`;
export const td = (al: string) => `border-b border-border px-3 py-2.5 ${AL[al] || 'text-left'} text-ink2`;

/** 카드 KPI 단축(Card 래핑이 필요할 때). */
export function KpiCard({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <Card>
      <div className="text-[11px] font-semibold text-ink2">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-[23px] font-extrabold tracking-tight tabular-nums" style={{ color: KTONE[tone || 'ink'] }}>{value}</span>
        {unit && <span className="text-[11px] font-semibold text-ink3">{unit}</span>}
      </div>
    </Card>
  );
}
