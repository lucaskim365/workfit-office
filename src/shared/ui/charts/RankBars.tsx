import { T } from '@/shared/theme/tokens';

export interface RankRow {
  label: string;
  v: number;
  c?: string;
}

interface RankBarsProps {
  rows: RankRow[];
  max?: number;
  barColor?: string;
}

/** 순위 막대 (TOP N) — 와이어프레임 shared.jsx RankBars 정본 이관. */
export function RankBars({ rows, max, barColor = T.teal }: RankBarsProps) {
  const m = max || Math.max(...rows.map((r) => r.v));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <span
            className={`w-[18px] text-center text-[11px] font-extrabold ${
              i < 3 ? 'text-navy' : 'text-ink3'
            }`}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex justify-between">
              <span className="truncate text-[11.5px] font-semibold text-ink">{r.label}</span>
              <span className="text-[11px] font-bold tabular-nums text-ink2">
                {r.v.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 rounded-[3px] bg-bg-deep">
              <div
                className="h-full rounded-[3px]"
                style={{ width: `${(r.v / m) * 100}%`, background: r.c || barColor }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
