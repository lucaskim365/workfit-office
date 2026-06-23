import { T } from '@/shared/theme/tokens';

interface GaugeProps {
  value: number;
  max?: number;
  label?: string;
  size?: number;
  color?: string;
}

/** 반원 게이지 (SVG) — 와이어프레임 shared.jsx Gauge 정본 이관. */
export function Gauge({ value, max = 100, label, size = 120, color = T.teal }: GaugeProps) {
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const circ = Math.PI * r;
  const frac = Math.min(value / max, 1);
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <svg width={size} height={size / 2 + 18} viewBox={`0 0 ${size} ${size / 2 + 18}`}>
      <path d={arc} fill="none" stroke={T.bgDeep} strokeWidth="10" strokeLinecap="round" />
      <path d={arc} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${frac * circ} ${circ}`} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="21" fontWeight="800" fill={T.ink}>{value}</text>
      {label && <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={T.ink3}>{label}</text>}
    </svg>
  );
}
