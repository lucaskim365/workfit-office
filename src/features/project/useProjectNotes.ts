import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workTaskNoteRepo, type NoteScope } from '@/data/workTaskNote/workTaskNote.repo';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkTaskCommentDraft } from '@/domain/workTaskNote/schema';

export const WORK_NOTES_KEY = 'workTaskNotes';

/**
 * 과업 댓글·첨부 훅.
 * ([[프로젝트관리_고도화_계획서.md]] §6)
 *
 * 캐시 키에 `includeSubtree`를 넣는다 — "이 과업만"과 "하위 포함"은 같은 과업을 보면서도
 * 결과가 다르다. 키를 공유하면 토글할 때 이전 목록이 잠깐 그대로 남는다.
 */
function scopeKey(actor: ProjectAccessContext, scope: NoteScope) {
  return [actor.userId, scope.projectId, scope.taskId, scope.includeSubtree ?? false] as const;
}

export function useTaskComments(actor: ProjectAccessContext, scope: NoteScope, enabled = true) {
  return useQuery({
    queryKey: [WORK_NOTES_KEY, 'comments', ...scopeKey(actor, scope)],
    queryFn: () => workTaskNoteRepo.listComments(actor, scope),
    enabled,
  });
}

export function useTaskFiles(actor: ProjectAccessContext, scope: NoteScope, enabled = true) {
  return useQuery({
    queryKey: [WORK_NOTES_KEY, 'files', ...scopeKey(actor, scope)],
    queryFn: () => workTaskNoteRepo.listFiles(actor, scope),
    enabled,
  });
}

/** 프로젝트에 딸린 파일 전체 — 상세 메인의 파일 칸. */
export function useProjectFiles(actor: ProjectAccessContext, projectId?: string) {
  return useQuery({
    queryKey: [WORK_NOTES_KEY, 'files', 'all', actor.userId, projectId ?? null],
    queryFn: () => workTaskNoteRepo.listAllFiles(actor, projectId ?? ''),
    enabled: Boolean(projectId),
  });
}

function useNoteMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [WORK_NOTES_KEY] }),
  });
}

export function useAddComment() {
  return useNoteMutation(({ actor, draft }: { actor: ProjectAccessContext; draft: WorkTaskCommentDraft }) => (
    workTaskNoteRepo.addComment(actor, draft)
  ));
}

export function useRemoveComment() {
  return useNoteMutation(({ actor, id }: { actor: ProjectAccessContext; id: string }) => (
    workTaskNoteRepo.removeComment(actor, id)
  ));
}

export function useUploadFile() {
  return useNoteMutation(({ actor, scope, file }: {
    actor: ProjectAccessContext;
    scope: { projectId: string; taskId: string | null };
    file: File;
  }) => workTaskNoteRepo.upload(actor, scope, file));
}

export function useRemoveFile() {
  return useNoteMutation(({ actor, id }: { actor: ProjectAccessContext; id: string }) => (
    workTaskNoteRepo.removeFile(actor, id)
  ));
}
