import type { PmPlan, PmPlanKpi } from './site';

/**
 * 성과지표(KPI) · AI 성능목표 계산 — 데모 kpiDefs · kImp · kpiEval · kpiScore · aiEval (6939~6961) 그대로.
 * 지표 = 사업계획서 1.5(내장 plan-data) + 직접 등록한 것. 실측 기록은 사람이 넣는다 (기록 0건이면 '실측 전').
 */

/** 직접 등록한 성과지표 (`pmKpiDefs`, 데모 S.kpiDefs[k]) */
export interface PmKpiDef {
  id: string;
  projectId: string;
  f: string;
  name: string;
  unit: string;
  dir: 'up' | 'down';
  base: number;
  target: number;
  w: number;
  period: string;
  method: string;
}
/** 실측 기록 (`pmKpiMeas`, 데모 S.kpiMeas) — kid = 지표 id (계획서 지표는 'P0'·'P1'…) */
export interface PmKpiMeas { id: string; projectId: string; kid: string; date: string; val: number; memo: string; who: string }
/** AI 성능 측정 기록 (`pmAiMeas`, 데모 S.aiMeas) — i = 계획서 AI 항목 순번 */
export interface PmAiMeas { id: string; projectId: string; i: number; date: string; val: number | null; ok: '' | '충족' | '미충족'; memo: string; who: string }
/** 계획서 2.6 AI 성능 항목 */
export interface PmPlanAi { n: string; unit: string; t: number; op: 'le' | 'ge' | 'chk'; tt: string; m: string }

export interface KpiDef extends PmPlanKpi { id: string; src: '계획서' | '직접 등록' }

/** 사업의 지표 목록: 계획서 지표(P0, P1 …) 다음 직접 등록 (kpiDefs) */
export function kpiDefs(plan: PmPlan | null, own: readonly PmKpiDef[]): KpiDef[] {
  return [
    ...(plan?.kpis ?? []).map((x, i) => ({ ...x, id: `P${i}`, src: '계획서' as const })),
    ...own.map((x) => ({ ...x, src: '직접 등록' as const })),
  ];
}
/** 개선율 % — 감소 지표는 줄어든 비율 (kImp). 기준값 0 이면 0 */
export const kImp = (x: Pick<PmPlanKpi, 'base' | 'dir'>, v: number) => {
  const b = +x.base;
  return b ? (x.dir === 'down' ? (b - v) / b : (v - b) / b) * 100 : 0;
};
const byDate = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
export const kpiMeasOf = (meas: readonly PmKpiMeas[], kid: string) => meas.filter((m) => m.kid === kid).sort(byDate);

export interface KpiEval { ms: PmKpiMeas[]; last: PmKpiMeas | null; tImp: number; imp?: number; ach?: number; ok?: boolean }
/** 지표 1개 판정 (kpiEval): 최근 실측의 개선율 ÷ 목표 개선율 = 달성률, 목표값 넘으면 '목표 달성' */
export function kpiEval(meas: readonly PmKpiMeas[], x: KpiDef): KpiEval {
  const ms = kpiMeasOf(meas, x.id);
  const last = ms[ms.length - 1] ?? null;
  const tImp = kImp(x, +x.target);
  if (!last) return { ms, last: null, tImp };
  const v = +last.val;
  const imp = kImp(x, v);
  const ach = tImp ? (imp / tImp) * 100 : 0;
  return { ms, last, tImp, imp, ach, ok: x.dir === 'down' ? v <= +x.target : v >= +x.target };
}
/** 가중 달성도 (kpiScore): 실측 있는 지표의 달성률(0~100으로 자름) × 가중치 ÷ 전체 가중치 합. 지표 없으면 null */
export function kpiScore(ds: readonly KpiDef[], meas: readonly PmKpiMeas[]): { n: number; total: number; score: number } | null {
  if (!ds.length) return null;
  let n = 0;
  let s = 0;
  let ws = 0;
  for (const x of ds) {
    const e = kpiEval(meas, x);
    const w = +(x.w ?? 0) || 0;
    ws += w;
    if (e.last) { n++; s += w * Math.max(0, Math.min(100, e.ach ?? 0)); }
  }
  return { n, total: ds.length, score: ws ? s / ws : 0 };
}
export const aiMeasOf = (meas: readonly PmAiMeas[], i: number) => meas.filter((m) => m.i === i).sort(byDate);
/** AI 항목 판정 (aiEval): 측정 없으면 null */
export function aiEval(x: PmPlanAi, last: PmAiMeas | null | undefined): boolean | null {
  if (!last) return null;
  if (x.op === 'chk') return last.ok === '충족';
  return x.op === 'le' ? +(last.val ?? 0) <= +x.t : +(last.val ?? 0) >= +x.t;
}
/** 숫자 · 개선율 글자 (fmtN · fmtP) */
export const fmtNum = (v: number | string | null | undefined) => (v === '' || v == null ? '-' : (+v).toLocaleString(undefined, { maximumFractionDigits: 2 }));
export const fmtPct = (v: number | null | undefined) => (v == null ? '-' : `${v >= 0 ? '+' : ''}${(+v).toFixed(1)}%`);
/** 실측 화면 기본 사업: 계획서 있는 첫 사업 (planPick) */
export const kpiPick = <P extends { id: string }>(list: readonly P[], plans: Readonly<Record<string, PmPlan>>, cur: string | null) =>
  list.find((p) => p.id === cur) ?? list.find((p) => plans[p.id]) ?? list[0] ?? null;
