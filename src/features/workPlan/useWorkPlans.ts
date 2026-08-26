import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workPlanRepo, type WorkPlanActor, type WorkPlanFilter } from '@/data/workPlan/workPlan.repo';
import type { WorkPlanDraft } from '@/domain/workPlan/schema';

const KEY = 'workPlans';

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

function useWorkPlanMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }) });
}

export function useCreateWorkPlan() {
  return useWorkPlanMutation(({ actor, draft }: { actor: WorkPlanActor; draft: WorkPlanDraft }) => workPlanRepo.create(actor, draft));
}

export function useUpdateWorkPlan() {
  return useWorkPlanMutation(({ actor, id, draft }: { actor: WorkPlanActor; id: string; draft: WorkPlanDraft }) => workPlanRepo.update(actor, id, draft));
}

export function useRemoveWorkPlan() {
  return useWorkPlanMutation(({ actor, id }: { actor: WorkPlanActor; id: string }) => workPlanRepo.remove(actor, id));
}
