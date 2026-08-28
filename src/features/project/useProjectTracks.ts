import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workTrackRepo } from '@/data/workTrack/workTrack.repo';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkTrackDraft } from '@/domain/workTrack/schema';

export const WORK_TRACKS_KEY = 'workTracks';

/**
 * 프로젝트 트랙 조회·편집 훅.
 * ([[프로젝트관리_고도화_계획서.md]] §2)
 *
 * 트랙이 바뀌면 과업 트리의 최상위 묶음이 달라지므로 WBS 캐시도 함께 비운다.
 */
export function useProjectTracks(actor: ProjectAccessContext, projectId?: string) {
  return useQuery({
    queryKey: [WORK_TRACKS_KEY, 'list', actor.userId, projectId ?? null],
    queryFn: () => workTrackRepo.list(actor, projectId ?? ''),
    enabled: Boolean(projectId),
  });
}

function useTrackMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WORK_TRACKS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['workProjectWbs'] });
    },
  });
}

export function useCreateTrack() {
  return useTrackMutation(({ actor, draft }: { actor: ProjectAccessContext; draft: WorkTrackDraft }) => (
    workTrackRepo.create(actor, draft)
  ));
}

export function useRenameTrack() {
  return useTrackMutation(({ actor, id, name }: { actor: ProjectAccessContext; id: string; name: string }) => (
    workTrackRepo.rename(actor, id, name)
  ));
}

export function useRemoveTrack() {
  return useTrackMutation(({ actor, id }: { actor: ProjectAccessContext; id: string }) => (
    workTrackRepo.remove(actor, id)
  ));
}

/** 프로젝트를 만든 직후 기본 트랙 3개를 채운다. 사용자가 원하지 않으면 부르지 않는다. */
export function useSeedDefaultTracks() {
  return useTrackMutation(({ actor, projectId }: { actor: ProjectAccessContext; projectId: string }) => (
    workTrackRepo.seedDefaults(actor, projectId)
  ));
}
