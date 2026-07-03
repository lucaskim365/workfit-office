import { C } from '../report/_report';
import type { DonutDatum } from '@/shared/ui/charts/Donut';

/**
 * 경영 현황 — 성과 관리(매출·거래처) 데이터 소스. 데모 샘플.
 * 대상 = 주요 거래처 / 대조군 = 전년 동기 / 지표 = 매출·성장률.
 *
 * ⚠ 화면은 `getExecPerformanceData()` 단일 소스만 호출. 실집계 전환 시 이 함수 내부만
 *    services/reporting 으로 교체하면 화면 무변경(계획서 §5 / [[data-layer-pattern]]).
 */

/** 상단 KPI 타일. trend 있으면 성장률(화살표) 타일. */
export interface PerfKpi {
  key: string;
  label: string;
  value: string;
  unit: string;
  trend?: 'up' | 'down';
  color: string;
  sub?: string;
}

export interface PerfWeekly {
  label: string;
  delta: number;
}

export interface PerfRow {
  no: number;
  name: string;
  region: string;
  before: number;
  after: number;
  growth: number;
}

export interface ExecPerformanceData {
  period: string;
  kpis: PerfKpi[];
  goal: { value: number; caption: string };
  trend: { labels: string[]; target: number[]; control: number[] };
  byIndustry: DonutDatum[];
  byRegion: DonutDatum[];
  weekly: PerfWeekly[];
  rows: PerfRow[];
}

const DATA: ExecPerformanceData = {
  period: '2026-06 (월간)',
  kpis: [
    { key: 'count', label: '모니터링 대상 거래처', value: '48', unit: '개', color: C.navy, sub: '매출 미제공 거래처 제외' },
    { key: 'yoy', label: '전년 동기 대비 평균 성장률', value: '18.4', unit: '%', trend: 'up', color: C.err, sub: '대상 거래처 매출 기준' },
    { key: 'mom', label: '전월 동기 대비 평균 성장률', value: '-3.2', unit: '%', trend: 'down', color: C.blue, sub: '단기 조정 구간' },
    { key: 'dday', label: '잔여 목표 기간', value: 'D-178', unit: '일', color: C.navy, sub: '2026.01.01 ~ 2026.12.31' },
  ],
  goal: { value: 93, caption: '대조군 대비 매출 신장률 30% 이상 달성' },
  trend: {
    labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월'],
    target: [28, 34, 40, 52, 61, 58, 70, 82],
    control: [26, 30, 33, 40, 46, 50, 55, 62],
  },
  byIndustry: [
    { name: '제조', v: 43.7, c: C.navy },
    { name: '유통업', v: 15.3, c: '#3a6ee0' },
    { name: '서비스업', v: 35.2, c: '#8ab4f8' },
    { name: '기타', v: 5.8, c: C.c5 },
  ],
  byRegion: [
    { name: '수도권', v: 43.7, c: C.navy },
    { name: '영남', v: 15.3, c: '#3a6ee0' },
    { name: '충청', v: 35.2, c: '#8ab4f8' },
    { name: '호남', v: 5.8, c: C.c5 },
  ],
  weekly: [
    { label: 'W42', delta: 3.4 }, { label: 'W43', delta: 3.3 }, { label: 'W44', delta: 2.4 },
    { label: 'W45', delta: -3.9 }, { label: 'W46', delta: 1.4 }, { label: 'W47', delta: 0.3 },
    { label: 'W48', delta: 0.9 }, { label: 'W49', delta: -4.7 }, { label: 'W50', delta: -4.3 },
    { label: 'W51', delta: -4.3 },
  ],
  rows: [
    { no: 1, name: '(주)한빛정밀', region: '수도권', before: 13_920_579, after: 19_244_278, growth: 38.2 },
    { no: 2, name: '대성전자(주)', region: '영남', before: 21_450_000, after: 24_180_500, growth: 12.7 },
    { no: 3, name: '우진테크', region: '수도권', before: 9_820_400, after: 14_360_900, growth: 46.2 },
    { no: 4, name: '세종메탈(주)', region: '충청', before: 18_600_000, after: 15_930_000, growth: -14.4 },
    { no: 5, name: '광성ENG', region: '호남', before: 7_310_800, after: 9_845_200, growth: 34.7 },
    { no: 6, name: '동아정밀(주)', region: '수도권', before: 26_540_000, after: 22_180_000, growth: -16.4 },
    { no: 7, name: '신영산업', region: '영남', before: 11_240_600, after: 15_902_300, growth: 41.5 },
  ],
};

/** 성과 관리(매출·거래처) 단일 데이터 소스(현재 샘플, 후속 실집계 교체 지점). */
export function getExecPerformanceData(): ExecPerformanceData {
  return DATA;
}
