import { useMemo } from 'react';
import { planHourRows, type PlanCtx } from '@/domain/pm/plan';
import type { PlCtx } from '@/domain/pm/pl';
import type { PmDerived } from './usePm';
import { usePmPlanCtx } from './usePmPlan';

/** 손익 계산 값 (domain/pm/pl) — 저장소 스냅숏 + 업무계획 '시간' 칸 (인건비) */
export function plCtxOf(d: PmDerived, C: PlanCtx): PlCtx {
  const { snap } = d;
  return { projects: snap.projects, contracts: snap.contracts, pays: snap.pays, costs: snap.costs, oh: snap.oh, cfg: snap.moneyCfg, hours: planHourRows(C, (id) => id), today: d.today };
}

export function usePmPl(d: PmDerived | null): PlCtx | null {
  const C = usePmPlanCtx(d);
  return useMemo(() => (d && C ? plCtxOf(d, C) : null), [d, C]);
}
