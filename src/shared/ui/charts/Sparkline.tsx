import { T } from '@/shared/theme/tokens';

interface SparklineProps {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
}

/** 스파크라인 (SVG) — 와이어프레임 shared.jsx Sparkline 정본 이관. */
export function Sparkline({ data, w = 80, h = 24, color = T.teal }: SparklineProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const rng = max - min || 1;
  const pts = data
    .map((v, i) => `${(w / (data.length - 1)) * i},${h - ((v - min) / rng) * (h - 4) - 2}`)
    .join(' ');
  return (
    <svg width={w} height={h}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
