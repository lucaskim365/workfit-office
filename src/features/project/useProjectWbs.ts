import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workPhaseRepo } from '@/data/workPhase/workPhase.repo';
import { workTaskRepo, type WorkTaskFilter } from '@/data/workTask/workTask.repo';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkPhaseDraft } from '@/domain/workPhase/schema';
import type { WorkTaskDraft } from '@/domain/workTask/schema';

export const WORK_WBS_KEY = 'projectWbs';

function actorKey(actor: ProjectAccessContext) {
  return [actor.userId, actor.deptId, actor.active] as const;
}

export function useWorkPhases(actor: ProjectAccessContext, projectId: string) {
  return useQuery({
    queryKey: [WORK_WBS_KEY, 'phases', ...actorKey(actor), projectId],
    queryFn: () => workPhaseRepo.list(actor, projectId),
    enabled: Boolean(projectId),
  });
}

export function useWorkTasks(actor: ProjectAccessContext, projectId: string, filter?: WorkTaskFilter) {
  return useQuery({
    queryKey: [WORK_WBS_KEY, 'tasks', ...actorKey(actor), projectId, filter ?? null],
    queryFn: () => workTaskRepo.list(actor, projectId, filter),
    enabled: Boolean(projectId),
  });
}

function useWbsMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: [WORK_WBS_KEY] }),
  });
}

export function useCreateWorkPhase() {
  return useWbsMutation(({
    actor,
    draft,
  }: {
    actor: ProjectAccessContext;
    draft: WorkPhaseDraft;
  }) => workPhaseRepo.create(actor, draft));
}

export function useUpdateWorkPhase() {
  return useWbsMutation(({
    actor,
    id,
    name,
  }: {
    actor: ProjectAccessContext;
    id: string;
    name: string;
  }) => workPhaseRepo.update(actor, id, name));
}

export function useRemoveWorkPhase() {
  return useWbsMutation(({
    actor,
    id,
  }: {
    actor: ProjectAccessContext;
    id: string;
  }) => workPhaseRepo.remove(actor, id));
}

export function useCreateWorkTask() {
  return useWbsMutation(({
    actor,
    draft,
  }: {
    actor: ProjectAccessContext;
    draft: WorkTaskDraft;
  }) => workTaskRepo.create(actor, draft));
}

export function useUpdateWorkTask() {
  return useWbsMutation(({
    actor,
    id,
    draft,
    expectedVersion,
  }: {
    actor: ProjectAccessContext;
    id: string;
    draft: WorkTaskDraft;
    expectedVersion: number;
  }) => workTaskRepo.update(actor, id, draft, expectedVersion));
}

export function useSetWorkTaskProgress() {
  return useWbsMutation(({
    actor,
    id,
    progress,
    expectedVersion,
  }: {
    actor: ProjectAccessContext;
    id: string;
    progress: number;
    expectedVersion: number;
  }) => workTaskRepo.setProgress(actor, id, progress, expectedVersion));
}

export function useRemoveWorkTask() {
  return useWbsMutation(({
    actor,
    id,
    expectedVersion,
  }: {
    actor: ProjectAccessContext;
    id: string;
    expectedVersion: number;
  }) => workTaskRepo.remove(actor, id, expectedVersion));
}
