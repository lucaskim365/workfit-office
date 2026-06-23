/** 생산관리 화면 공용 소품: 읽기 셀렉트 + 진행 막대. */
export function ReadSelect({ value, w }: { value: string; w?: number }) {
  return (
    <span
      style={w ? { minWidth: w } : undefined}
      className="inline-flex min-w-[110px] items-center justify-between gap-3.5 rounded-md border border-border-hi bg-panel px-3 py-1.5 text-[11.5px] font-semibold text-ink"
    >
      {value} <span className="text-[8px] text-ink3">▾</span>
    </span>
  );
}

export function ProgBar({ v, max = 100 }: { v: number; max?: number }) {
  const pct = Math.min((v / max) * 100, 100);
  const cls = pct >= 100 ? 'bg-ok' : pct >= 70 ? 'bg-teal' : 'bg-amber';
  return (
    <div className="flex min-w-[120px] items-center gap-2">
      <div className="h-[7px] flex-1 rounded bg-bg-deep">
        <div className={`h-full rounded ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-[10.5px] font-bold tabular-nums text-ink2">{Math.round(pct)}%</span>
    </div>
  );
}
