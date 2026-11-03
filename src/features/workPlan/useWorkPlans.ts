import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WorkPlanError, workPlanRepo, type WorkPlanActor, type WorkPlanFilter } from '@/data/workPlan/workPlan.repo';
import type { MemoPlanRef } from '@/domain/workPlan/dayEntries';
import { memoToContent } from '@/domain/workPlan/memo';
import type { WorkPlan, WorkPlanDraft } from '@/domain/workPlan/schema';

const KEY = 'workPlans';
const CALENDAR_KEY = 'calendarEvents';

export function useMyWorkPlans(actor: WorkPlanActor, filter?: WorkPlanFilter) {
  return useQuery({
    queryKey: [KEY, 'mine', actor.userId, actor.active, filter ?? null],
    queryFn: () => workPlanRepo.list(actor, filter),
  });
}

export function useAllWorkPlans(filter: WorkPlanFilter | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'all', filter ?? null],
    queryFn: () => workPlanRepo.listAll(filter),
    enabled,
  });
}

function useWorkPlanMutation<T, R = unknown>(mutationFn: (input: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: [CALENDAR_KEY] });
    },
  });
}

export function useCreateWorkPlan() {
  return useWorkPlanMutation<
    { actor: WorkPlanActor; draft: WorkPlanDraft },
    WorkPlan
  >(({ actor, draft }) => workPlanRepo.create(actor, draft));
}

export function useUpdateWorkPlan() {
  return useWorkPlanMutation<
    { actor: WorkPlanActor; id: string; draft: WorkPlanDraft; expectedUpdatedAt?: string },
    WorkPlan
  >(({ actor, id, draft, expectedUpdatedAt }) => workPlanRepo.update(actor, id, draft, expectedUpdatedAt));
}

export function useRemoveWorkPlan() {
  return useWorkPlanMutation<
    { actor: WorkPlanActor; id: string },
    WorkPlan
  >(({ actor, id }) => workPlanRepo.remove(actor, id));
}

/**
 * 칸 메모 저장 — 본인 칸만. 글을 비우면 문서를 지우고, 문서가 있으면 고치고(동시 수정 검사), 없으면 만든다.
 * 다른 사람 메모는 고칠 수 없다(전사 공통 일정 줄은 이 함수를 쓰지 않는다).
 */
export function useSaveWorkPlanMemo() {
  return useWorkPlanMutation<
    { actor: WorkPlanActor; ownerUserId: string; date: string; memoPlan: MemoPlanRef | null; text: string },
    unknown
  >(async ({ actor, ownerUserId, date, memoPlan, text }) => {
    if (ownerUserId !== actor.userId) throw new WorkPlanError('FORBIDDEN', '본인 메모만 고칠 수 있습니다.');
    const content = memoToContent(text);
    if (!content) return memoPlan ? workPlanRepo.remove(actor, memoPlan.id) : null;
    if (memoPlan) return workPlanRepo.update(actor, memoPlan.id, { date, content }, memoPlan.updatedAt);
    return workPlanRepo.create(actor, { date, content, ownerUserId });
  });
}
