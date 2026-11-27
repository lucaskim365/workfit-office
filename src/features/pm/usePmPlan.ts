import { useEffect, useMemo } from 'react';
import { nextWorkday, planCtx, planEditable, type PlanCtx } from '@/domain/pm/plan';
import type { PmPlanItem } from '@/domain/pm/schema';
import { applyPmSnapshot, derivePm, type PmDerived } from './usePm';
import { PmLatestError, type PmMake } from '@/data/pm/pm.store';
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
 * 그날 업무계획 고치기 (G2 — 최신 값에서 다시 계산): 화면은 '무엇을 바꿀지'(fn)만 넘기고, 저장 차례가 오면
 * 저장소 지금 상태로 그날 목록(planEditable)을 만들어 fn 을 적용한다. fn 이 false = 할 것 없음(이미 들어 있음 등) → 안 씀.
 * 앞 저장(메모 등)이 아직 화면에 안 나온 사이 누른 둘째 저장도 앞 결과 위에서 계산 → 둘 다 남음.
 */
export function planDayEdit(who: string, date: string, fn: (a: PmPlanItem[], C: PlanCtx) => void | false): PmMake<[string, string, PmPlanItem[]]> {
  return (snap) => {
    const C = planCtxOf(derivePm(snap));
    const a = planEditable(C, who, date);
    return fn(a, C) === false ? null : [who, date, a];
  };
}

/** 줄 열쇠 (G2 M4) — 세부 작업 id · 업무 id · 티켓 · 액션 · 글 중 먼저 있는 것 + 같은 열쇠 가운데 몇 번째. 화면 줄 번호 대신 */
export interface PlanKey { k: string; n: number }
const keyOf = (x: PmPlanItem) => (x.subId ? `s:${x.subId}` : x.taskId ? `t:${x.taskId}` : x.ticketNo ? `k:${x.ticketNo}` : x.actionId ? `a:${x.actionId}` : `x:${x.text ?? ''}`);
export function planKey(list: readonly PmPlanItem[], i: number): PlanKey {
  const k = keyOf(list[i]);
  let n = 0;
  for (let j = 0; j < i; j++) if (keyOf(list[j]) === k) n++;
  return { k, n };
}
/** 최신 목록에서 그 줄의 자리 — 없으면 쓰지 않고 안내 */
export function planAt(list: readonly PmPlanItem[], key: PlanKey): number {
  let n = 0;
  for (let j = 0; j < list.length; j++) if (keyOf(list[j]) === key.k) { if (n === key.n) return j; n++; }
  throw new PmLatestError('그 줄이 없어졌습니다 (다른 곳에서 먼저 바뀜) — 화면을 다시 확인해 주세요');
}
/** 같은 일이 이미 있으면 안 넣음 (G2 M3 — 두 번 눌림) */
export const planHas = (list: readonly PmPlanItem[], it: PmPlanItem) => list.some((x) => keyOf(x) === keyOf(it));

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
