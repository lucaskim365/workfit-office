import { T } from '@/shared/theme/tokens';

export interface DivergingDatum {
  label: string;
  delta: number;
}

interface DivergingBarsProps {
  data: DivergingDatum[];
  w?: number;
  h?: number;
  /** 0 기준 위/아래 최대 절대값(고정 스케일). 미지정 시 데이터 최대치*1.2. */
  max?: number;
  /** 상승(양수) 색 / 하락(음수) 색. */
  upColor?: string;
  downColor?: string;
  /** 값 라벨 접미사(예: '%'). */
  unit?: string;
}

/**
 * 발산 막대 차트 (SVG) — 0 기준선 위=상승/아래=하락. 주간 증감 등 +/- 파형 표현.
 * GroupedBars(동일 축 그룹)로는 표현 못 하는 증감 시각화용 신규 컴포넌트.
 */
export function DivergingBars({
  data,
  w = 560,
  h = 220,
  max,
  upColor = T.err,
  downColor = T.blue,
  unit = '',
}: DivergingBarsProps) {
  const padL = 8;
  const padR = 8;
  const padT = 20;
  const padB = 22;
  const iw = w - padL - padR;
  const ih = h - padT - padB;
  const mid = padT + ih / 2;
  const m = max || Math.max(...data.map((d) => Math.abs(d.delta))) * 1.2 || 1;
  const slot = iw / data.length;
  const barW = Math.min(26, slot * 0.5);

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {/* 0 기준선 */}
      <line x1={padL} y1={mid} x2={w - padR} y2={mid} stroke={T.borderHi} strokeWidth="1" />
      {data.map((d, i) => {
        const cx = padL + slot * i + slot / 2;
        const bh = (Math.abs(d.delta) / m) * (ih / 2);
        const up = d.delta >= 0;
        const y = up ? mid - bh : mid;
        const color = up ? upColor : downColor;
        return (
          <g key={d.label}>
            <rect x={cx - barW / 2} y={y} width={barW} height={Math.max(bh, 0.5)} rx="2" fill={color} />
            {/* 값 라벨 */}
            <text
              x={cx}
              y={up ? y - 5 : y + bh + 11}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="700"
              fill={color}
            >
              {d.delta > 0 ? '+' : ''}{d.delta}{unit}
            </text>
            {/* X 라벨 */}
            <text x={cx} y={h - 6} textAnchor="middle" fontSize="8.5" fill={T.ink3}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
