import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pmStore, type PmSnapshot } from '@/data/pm/pm.store';
import { doneInfoOf, liveOf, todayStr, type FilterCtx, type Live } from '@/domain/pm/rules';
import type { PmSubtask, PmTask, PmTaskDone, PmTaskFunctions } from '@/domain/pm/schema';

/**
 * PM 화면 훅. 1단계는 저장소 전체를 한 번에 읽는다 (업무 338건 — 작음).
 * 저장 후 다시 읽기 (TanStack Query invalidate).
 */
const KEY = ['pm'] as const;

export function usePmSnapshot() {
  return useQuery({ queryKey: [...KEY, 'snapshot'], queryFn: () => pmStore().snapshot(), staleTime: Infinity });
}

/** 화면에서 여러 번 쓰는 파생값 — 업무별 상태·실적, 완료 기록, 세부 작업 묶음 */
export interface PmDerived {
  snap: PmSnapshot;
  today: string;
  liveMap: Map<string, Live>;
  doneMap: Map<string, PmTaskDone>;
  fnMap: Map<string, PmTaskFunctions>;
  subsByTask: Map<string, PmSubtask[]>;
  taskMap: Map<string, PmTask>;
  ctx: FilterCtx;
}

export function usePmDerived(nameOf?: (id: string) => string): PmDerived | null {
  const q = usePmSnapshot();
  const snap = q.data;
  return useMemo(() => {
    if (!snap) return null;
    const today = todayStr();
    const liveMap = new Map(snap.tasks.map((t) => [t.id, liveOf(t)]));
    const doneMap = new Map(snap.done.map((d) => [d.id, d]));
    const fnMap = new Map(snap.functions.map((f) => [f.id, f]));
    const subsByTask = new Map<string, PmSubtask[]>();
    for (const s of [...snap.subtasks].sort((a, b) => a.order - b.order)) {
      const a = subsByTask.get(s.taskId) ?? [];
      a.push(s);
      subsByTask.set(s.taskId, a);
    }
    const taskMap = new Map(snap.tasks.map((t) => [t.id, t]));
    const ctx: FilterCtx = {
      today,
      liveMap,
      ticketed: new Set(), // 티켓은 2단계
      doneInfo: (t) => doneInfoOf(t, liveMap.get(t.id) ?? liveOf(t), doneMap, snap.logs),
      nameOf,
    };
    return { snap, today, liveMap, doneMap, fnMap, subsByTask, taskMap, ctx };
  }, [snap, nameOf]);
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function usePmMutations(me: string, nameOf?: (id: string) => string) {
  const done = useInvalidate();
  const s = pmStore();
  const m = <A,>(fn: (a: A) => Promise<unknown>) => useMutation({ mutationFn: fn, onSuccess: done });
  return {
    addTask: m((t: PmTask) => s.addTask(t, me)),
    updateTask: m(({ id, next }: { id: string; next: PmTask }) => s.updateTask(id, next, me, nameOf)),
    bulkUpdate: m((items: Array<{ next: PmTask; summary: string }>) => s.bulkUpdate(items, me)),
    setProgress: m(({ id, pct, why }: { id: string; pct: number; why: string }) => s.setProgress(id, pct, why, me)),
    addSubtask: m(({ taskId, text, assigneeId, due }: { taskId: string; text: string; assigneeId: string; due: string }) => s.addSubtask(taskId, text, assigneeId, due, me)),
    updateSubtask: m(({ id, patch }: { id: string; patch: Partial<Omit<PmSubtask, 'id' | 'taskId'>> }) => s.updateSubtask(id, patch)),
    removeSubtask: m((id: string) => s.removeSubtask(id)),
    resetBaseline: m(({ projectId, label }: { projectId: string; label: string }) => s.resetBaseline(projectId, label, me)),
  };
}
