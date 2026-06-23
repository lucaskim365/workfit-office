import { T } from '@/shared/theme/tokens';

interface Series {
  data: number[];
  c: string;
}

interface LineChartProps {
  series: Series[];
  labels: string[];
  w?: number;
  h?: number;
  max?: number;
  grid?: number;
  area?: boolean;
}

/** 라인 차트 (SVG) — 와이어프레임 shared.jsx LineChart 정본 이관. */
export function LineChart({ series, labels, w = 460, h = 200, max, grid = 4, area = false }: LineChartProps) {
  const padL = 30;
  const padB = 24;
  const padT = 10;
  const padR = 10;
  const iw = w - padL - padR;
  const ih = h - padB - padT;
  const m = max || Math.max(...series.flatMap((s) => s.data)) * 1.15;
  const x = (i: number) => padL + (iw / (labels.length - 1)) * i;
  const y = (v: number) => padT + ih - (v / m) * ih;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {Array.from({ length: grid + 1 }).map((_, i) => {
        const gy = padT + (ih / grid) * i;
        return <line key={i} x1={padL} y1={gy} x2={w - padR} y2={gy} stroke={T.border} strokeWidth="1" />;
      })}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize="8.5" fill={T.ink3}>{l}</text>
      ))}
      {series.map((s, si) => {
        const pts = s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
        const areaPath = `M ${x(0)},${padT + ih} L ${s.data.map((v, i) => `${x(i)},${y(v)}`).join(' L ')} L ${x(labels.length - 1)},${padT + ih} Z`;
        return (
          <g key={si}>
            {area && <path d={areaPath} fill={s.c} fillOpacity="0.1" />}
            <polyline points={pts} fill="none" stroke={s.c} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            {s.data.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#fff" stroke={s.c} strokeWidth="2" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
