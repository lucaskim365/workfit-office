export interface KpiProps {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  tone?: 'teal' | 'blue' | 'ink';
}

/** KPI 지표 — 와이어프레임 shared.jsx Kpi 정본 이관. */
export function Kpi({ label, value, unit, delta, tone = 'ink' }: KpiProps) {
  const valColor = tone === 'teal' ? 'text-teal' : tone === 'blue' ? 'text-blue' : 'text-ink';
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] font-semibold text-ink2">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-[23px] font-extrabold tracking-tight tabular-nums ${valColor}`}>
          {value}
        </span>
        {unit && <span className="text-[11px] font-semibold text-ink3">{unit}</span>}
        {delta != null && (
          <span
            className={`ml-0.5 text-[11px] font-bold ${delta >= 0 ? 'text-ok' : 'text-danger'}`}
          >
            {delta >= 0 ? '▲' : '▼'}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}
