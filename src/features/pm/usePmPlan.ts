import { useEffect, useMemo } from 'react';
import { nextWorkday, planCtx, type PlanCtx } from '@/domain/pm/plan';
import { applyPmSnapshot, type PmDerived } from './usePm';
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
