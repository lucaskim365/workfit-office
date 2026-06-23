import { T } from '@/shared/theme/tokens';
import type { KpiProps } from '@/shared/ui/Kpi';
import type { DonutDatum } from '@/shared/ui/charts/Donut';
import type { RankRow } from '@/shared/ui/charts/RankBars';
import type { Tone } from '@/shared/ui/Pill';

/**
 * 통합 모니터링 샘플 데이터 — 와이어프레임 mes/data.jsx 정본 이관.
 * Phase 1 후반에 Firestore 실데이터로 대체 예정.
 */
export interface AlarmItem {
  tone: Tone;
  tag: string;
  code: string;
  msg: string;
  t: string;
}

export interface InspSummary {
  계획: number;
  완료: number;
  진행: number;
  불합격: number;
  합격률: number;
}

export const KPIS: KpiProps[] = [
  { label: '종합 가동률(OEE)', value: '87.4', unit: '%', delta: 2.3, tone: 'teal' },
  { label: '수율(Yield)', value: '96.1', unit: '%', delta: 0.8, tone: 'blue' },
  { label: '당일 생산량', value: '4,182', unit: 'EA', delta: 4.5, tone: 'ink' },
  { label: '불량률(PPM)', value: '312', unit: 'ppm', delta: -6.1, tone: 'ink' },
];

export const TARGET_ACTUAL = [
  { label: '12.31', 목표: 320, 실적: 298 },
  { label: '01.31', 목표: 340, 실적: 351 },
  { label: '02.28', 목표: 360, 실적: 333 },
  { label: '03.31', 목표: 380, 실적: 372 },
  { label: '04.30', 목표: 400, 실적: 418 },
  { label: '05.31', 목표: 420, 실적: 406 },
];

export const EQUIP_STATUS: DonutDatum[] = [
  { name: '가동', v: 62, c: T.teal },
  { name: '대기', v: 18, c: T.blue },
  { name: '정지', v: 12, c: T.warn },
  { name: '고장', v: 8, c: T.err },
];

export const DEFECTS: RankRow[] = [
  { label: 'LB-1001 · Scratch', v: 1320, c: T.c1 },
  { label: 'LB-1002 · Particle', v: 980, c: T.c2 },
  { label: 'A-2210 · Misalign', v: 742, c: T.c3 },
  { label: 'A-0521 · Crack', v: 511, c: T.c4 },
  { label: 'C-3300 · Stain', v: 388, c: T.c5 },
];

export const ALARMS: AlarmItem[] = [
  { tone: 'err', tag: 'ERROR', code: 'ALM-1027', msg: 'CMP02 척킹 압력 임계 초과', t: '14:22' },
  { tone: 'warn', tag: 'WARN', code: 'ALM-0911', msg: 'ETCH01 챔버 온도 상한 근접', t: '14:08' },
  { tone: 'info', tag: 'INFO', code: 'SPC-0142', msg: 'Photo Line SPC 룰 위반 감지', t: '13:51' },
  { tone: 'info', tag: 'INFO', code: 'PM-0033', msg: 'DEP03 예방정비 일정 도래', t: '13:30' },
  { tone: 'warn', tag: 'WARN', code: 'ALM-0884', msg: 'OVEN05 가스 유량 편차 발생', t: '12:47' },
];

export const INSP_INCOMING: InspSummary = { 계획: 12, 완료: 9, 진행: 2, 불합격: 1, 합격률: 92 };
export const INSP_SHIP: InspSummary = { 계획: 18, 완료: 15, 진행: 2, 불합격: 0, 합격률: 100 };

/** KPI 카드용 스파크라인 샘플. */
export const SPARK = [12, 18, 14, 22, 19, 26, 24];
