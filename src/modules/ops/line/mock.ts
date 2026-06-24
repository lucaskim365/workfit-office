import { T } from '@/shared/theme/tokens';
import type { DonutDatum } from '@/shared/ui/charts/Donut';
import type { RankRow } from '@/shared/ui/charts/RankBars';

export type LineState = '가동' | '정지' | '대기';

export interface LineCard {
  name: string;
  proc: string;
  product: string;
  state: LineState;
  oee: number;
  plan: number;
  actual: number;
  shift: string;
  runtime: string;
  /** 정지/대기 시 사유와 경과(분). */
  reason?: string;
  downMin?: number;
}

/** 라인별 실시간 가동 현황(목 데이터). */
export const LINES: LineCard[] = [
  { name: 'M-Line 1', proc: '가공·조립', product: 'MX-200', state: '가동', oee: 86.6, plan: 4800, actual: 4720, shift: '주간', runtime: '6.2h' },
  { name: 'M-Line 2', proc: '가공', product: 'MX-310', state: '가동', oee: 88.1, plan: 3600, actual: 3540, shift: '주간', runtime: '6.0h' },
  { name: 'A-Line', proc: '패키징', product: 'PKG-BGA', state: '정지', oee: 0, plan: 6000, actual: 2280, shift: '주간', runtime: '4.1h', reason: '금형 교체', downMin: 12 },
  { name: 'B-Line', proc: '패키징', product: 'PKG-BGA', state: '가동', oee: 79.4, plan: 6000, actual: 5400, shift: '주간', runtime: '5.4h' },
  { name: 'C-Line', proc: '검사', product: 'MX-200', state: '가동', oee: 92.3, plan: 2400, actual: 2360, shift: '주간', runtime: '6.3h' },
];

/** 라인 가동 상태 구성(도넛). */
export const STATE_MIX: DonutDatum[] = [
  { name: '가동', v: 4, c: T.teal },
  { name: '정지', v: 1, c: T.err },
  { name: '대기', v: 0, c: T.warn },
];

/** 비가동 사유별 누적 시간(분). */
export const DOWN_REASONS: RankRow[] = [
  { label: '금형 교체', v: 320, c: T.navy },
  { label: '자재 대기', v: 245, c: T.blue },
  { label: '설비 고장', v: 188, c: T.err },
  { label: '품질 조정', v: 142, c: T.warn },
  { label: '계획 정지', v: 96, c: T.c5 },
];

/** 라인별 금일 계획 대비 실적. */
export const LINE_OUTPUT = LINES.map((l) => ({ label: l.name, 계획: l.plan, 실적: l.actual }));

/** 시간대별 종합 가동률 추이(%). */
export const UTIL_TREND = [62, 71, 84, 88, 80, 86];
export const UTIL_LABELS = ['08시', '10시', '12시', '14시', '16시', '18시'];
