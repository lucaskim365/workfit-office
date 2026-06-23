import { T } from '@/shared/theme/tokens';

export interface DonutDatum {
  name: string;
  v: number;
  c: string;
}

interface DonutProps {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  centerTop?: string;
  centerSub?: string;
}

/** 도넛 차트 (SVG) — 와이어프레임 shared.jsx Donut 정본 이관. */
export function Donut({ data, size = 130, thickness = 22, centerTop, centerSub }: DonutProps) {
  const total = data.reduce((s, d) => s + d.v, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {data.map((d, i) => {
          const dash = (d.v / total) * circ;
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={d.c}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </g>
      {centerTop && (
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={21} fontWeight="800" fill={T.ink}>
          {centerTop}
        </text>
      )}
      {centerSub && (
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={10} fontWeight="600" fill={T.ink3}>
          {centerSub}
        </text>
      )}
    </svg>
  );
}
