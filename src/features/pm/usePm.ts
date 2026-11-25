import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pmStore, type PmSnapshot } from '@/data/pm/pm.store';
import { doneInfoOf, liveOf, todayStr, type FilterCtx, type Live } from '@/domain/pm/rules';
import type { PmSubtask, PmTask, PmTaskDone, PmTaskFunctions } from '@/domain/pm/schema';
import { taskTicketIndex, ticketDoneInfo, type PmTicket } from '@/domain/pm/ticket';

/**
 * PM 화면 훅. 저장소 전체를 한 번에 읽는다 (업무 338건 — 작음).
 * 저장 후 다시 읽기 (TanStack Query invalidate).
 */
const KEY = ['pm'] as const;

export function usePmSnapshot() {
  return useQuery({ queryKey: [...KEY, 'snapshot'], queryFn: () => pmStore().snapshot(), staleTime: Infinity });
}

/** 화면에서 여러 번 쓰는 파생값 — 업무별 상태·실적(티켓 반영), 완료 기록, 세부 작업 묶음, 티켓 색인 */
export interface PmDerived {
  snap: PmSnapshot;
  today: string;
  liveMap: Map<string, Live>;
  doneMap: Map<string, PmTaskDone>;
  fnMap: Map<string, PmTaskFunctions>;
  subsByTask: Map<string, PmSubtask[]>;
  taskMap: Map<string, PmTask>;
  /** 업무 ID → 업무 티켓 (취소·세부·옛 티켓 제외) */
  taskTicket: Map<string, PmTicket>;
  ticketMap: Map<string, PmTicket>;
  ctx: FilterCtx;
}

export function usePmDerived(nameOf?: (id: string) => string): PmDerived | null {
  const q = usePmSnapshot();
  const snap = q.data;
  return useMemo(() => {
    if (!snap) return null;
    const today = todayStr();
    const taskTicket = taskTicketIndex(snap.tickets);
    const ticketMap = new Map(snap.tickets.map((x) => [x.no, x]));
    const liveMap = new Map(snap.tasks.map((t) => [t.id, liveOf(t, taskTicket.get(t.id))]));
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
      ticketed: new Set(taskTicket.keys()),
      // 언제·누가 완료: 직접 완료 기록 → 업무 티켓 승인 → 변경 이력 (doneInfo)
      doneInfo: (t) => {
        const l = liveMap.get(t.id) ?? liveOf(t);
        const own = d0(t, l);
        if (own && own.date) return own;
        const tk = ticketDoneInfo(taskTicket.get(t.id));
        return tk ? { date: tk.date, by: tk.by, prevPct: null, ticketNo: tk.ticketNo } : own;
      },
      nameOf,
    };
    function d0(t: PmTask, l: Live) { return doneInfoOf(t, l, doneMap, snap!.logs); }
    return { snap, today, liveMap, doneMap, fnMap, subsByTask, taskMap, taskTicket, ticketMap, ctx };
  }, [snap, nameOf]);
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function usePmMutations(me: string, nameOf?: (id: string) => string) {
  const done = useInvalidate();
  const s = pmStore();
  const nm = nameOf ?? ((x: string) => x);
  const m = <A, R = unknown>(fn: (a: A) => Promise<R>) => useMutation({ mutationFn: fn, onSuccess: done });
  return {
    addTask: m((t: PmTask) => s.addTask(t, me)),
    updateTask: m(({ id, next }: { id: string; next: PmTask }) => s.updateTask(id, next, me, nameOf)),
    bulkUpdate: m((items: Array<{ next: PmTask; summary: string }>) => s.bulkUpdate(items, me)),
    setProgress: m(({ id, pct, why }: { id: string; pct: number; why: string }) => s.setProgress(id, pct, why, me)),
    addSubtask: m(({ taskId, text, assigneeId, due }: { taskId: string; text: string; assigneeId: string; due: string }) => s.addSubtask(taskId, text, assigneeId, due, me)),
    updateSubtask: m(({ id, patch }: { id: string; patch: Partial<Omit<PmSubtask, 'id' | 'taskId'>> }) => s.updateSubtask(id, patch)),
    removeSubtask: m((id: string) => s.removeSubtask(id)),
    resetBaseline: m(({ projectId, label }: { projectId: string; label: string }) => s.resetBaseline(projectId, label, me)),
    // 티켓
    issueTickets: m((list: PmTicket[]) => s.issueTickets(list)),
    moveTicket: m(({ no, to, cmt }: { no: string; to: PmTicket['status']; cmt: string }) => s.moveTicket(no, to, cmt, me, nm)),
    putTicket: m((x: PmTicket) => s.putTicket(x)),
    commentTicket: m(({ no, text }: { no: string; text: string }) => s.commentTicket(no, text, me)),
    addTicketFile: m(({ no, name }: { no: string; name: string }) => s.addTicketFile(no, name, me)),
    removeTicketFile: m(({ no, index }: { no: string; index: number }) => s.removeTicketFile(no, index, me)),
  };
}
