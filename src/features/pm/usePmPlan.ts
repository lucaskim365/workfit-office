import { useEffect, useMemo } from 'react';
import { nextWorkday, planCtx, type PlanCtx } from '@/domain/pm/plan';
import { applyPmSnapshot, type PmDerived } from './usePm';
import { pmBase, type PmBases } from '@/data/pm/pm.store';
import { pmStore } from '@/data/pm/pmStoreInstance';
import { useQueryClient } from '@tanstack/react-query';

/**
 * 업무계획 계산 도구 (domain/pm/plan) — 저장소 스냅숏에서 한 번 만든다.
 * 업무계획 · 팀 현황 · 내 업무 · 업무 창이 같이 쓴다.
 */
export function planCtxOf(d: PmDerived): PlanCtx {
  const { snap } = d;
  return planCtx({
    today: d.today, tasks: snap.tasks, liveMap: d.liveMap, projects: snap.projects, subtasks: snap.subtasks,
    plans: snap.planDays, reps: snap.planReps, later: snap.later, tickets: snap.tickets, actions: snap.actions,
    drafts: snap.pdfDrafts, carryFrom: snap.settings.carryFrom,
  });
}

/**
 * 그날 업무계획 저장(setPlanDay)의 기준표 (G1) — 저장은 그날 목록을 화면 값으로 통째 씀 → 표 = 화면의 그날 저장 기록(없으면 null).
 * 다른 탭 · 다른 사람이 그사이 그날 계획을 바꿨으면 막힘.
 */
export const planDayBase = (C: PlanCtx, who: string, date: string): PmBases => {
  const it = C.saved(who, date);
  return [pmBase('planDays', `${who}|${date}`, it ? { items: it } : null, ['items'])];
};

export function usePmPlanCtx(d: PmDerived | null): PlanCtx | null {
  const qc = useQueryClient();
  const cf = d?.snap.settings.carryFrom;
  const today = d?.today;
  // 어제 남은 일 자동 넘기기는 이 기능이 처음 열린 다음 근무일부터 (S.carryFrom — 근무 중에 목록이 바뀌지 않게)
  useEffect(() => {
    if (today && cf === '') void pmStore().ensureCarryFrom(nextWorkday(today)).then(() => applyPmSnapshot(qc), () => applyPmSnapshot(qc));
  }, [cf, today, qc]);
  return useMemo(() => (d ? planCtxOf(d) : null), [d]);
}
