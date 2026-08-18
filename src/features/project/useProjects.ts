import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  workProjectRepo,
  type WorkProjectFilter,
} from '@/data/workProject/workProject.repo';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkProjectDraft } from '@/domain/workProject/schema';

export const WORK_PROJECTS_KEY = 'workProjects';

function actorKey(actor: ProjectAccessContext) {
  return [actor.userId, actor.deptId, actor.active] as const;
}

export function useProjects(actor: ProjectAccessContext, filter?: WorkProjectFilter) {
  return useQuery({
    queryKey: [WORK_PROJECTS_KEY, 'list', ...actorKey(actor), filter ?? null],
    queryFn: () => workProjectRepo.list(actor, filter),
  });
}

export function useProject(actor: ProjectAccessContext, id?: string) {
  return useQuery({
    queryKey: [WORK_PROJECTS_KEY, 'detail', ...actorKey(actor), id ?? null],
    queryFn: () => workProjectRepo.get(actor, id ?? ''),
    enabled: Boolean(id),
  });
}

function useProjectMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [WORK_PROJECTS_KEY] }),
  });
}

export function useCreateProject() {
  return useProjectMutation(({ actor, draft }: { actor: ProjectAccessContext; draft: WorkProjectDraft }) => (
    workProjectRepo.create(actor, draft)
  ));
}

export function useUpdateProject() {
  return useProjectMutation(({
    actor,
    id,
    draft,
  }: {
    actor: ProjectAccessContext;
    id: string;
    draft: WorkProjectDraft;
  }) => workProjectRepo.update(actor, id, draft));
}
