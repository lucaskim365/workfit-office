import { T } from '@/shared/theme/tokens';

interface Series {
  key: string;
  c: string;
}

interface GroupedBarsProps {
  data: Array<Record<string, string | number>>;
  series: Series[];
  w?: number;
  h?: number;
  max?: number;
  grid?: number;
}

/** 그룹 막대 차트 (SVG) — 와이어프레임 shared.jsx GroupedBars 정본 이관. */
export function GroupedBars({ data, series, w = 460, h = 220, max, grid = 4 }: GroupedBarsProps) {
  const padL = 34;
  const padB = 26;
  const padT = 12;
  const padR = 8;
  const iw = w - padL - padR;
  const ih = h - padB - padT;
  const m =
    max || Math.max(...data.flatMap((d) => series.map((s) => Number(d[s.key])))) * 1.1;
  const groupW = iw / data.length;
  const barGap = 4;
  const barW = Math.min(16, (groupW * 0.62 - barGap * (series.length - 1)) / series.length);

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {Array.from({ length: grid + 1 }).map((_, i) => {
        const y = padT + (ih / grid) * i;
        return <line key={i} x1={padL} y1={y} x2={w - padR} y2={y} stroke={T.border} strokeWidth="1" />;
      })}
      {Array.from({ length: grid + 1 }).map((_, i) => {
        const y = padT + (ih / grid) * i;
        const val = Math.round(m - (m / grid) * i);
        return (
          <text key={i} x={padL - 6} y={y + 3} textAnchor="end" fontSize="8" fill={T.ink3}>
            {val}
          </text>
        );
      })}
      {data.map((d, gi) => {
        const gx = padL + groupW * gi + groupW / 2;
        const totalW = barW * series.length + barGap * (series.length - 1);
        return (
          <g key={gi}>
            {series.map((s, si) => {
              const bh = (Number(d[s.key]) / m) * ih;
              const x = gx - totalW / 2 + si * (barW + barGap);
              return (
                <rect key={si} x={x} y={padT + ih - bh} width={barW} height={bh} rx="2" fill={s.c} />
              );
            })}
            <text x={gx} y={h - 9} textAnchor="middle" fontSize="8.5" fill={T.ink3}>
              {String(d.label)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
