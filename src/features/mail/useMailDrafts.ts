import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@/domain/user/schema';
import type { MailDraft } from '@/domain/mail/schema';
import { draftStore } from '@/data/mail/draft.store';
import { MAIL_INBOX_KEY } from './useMailAccounts';

export const MAIL_DRAFT_KEY = 'gw-mail-drafts';

/**
 * 임시보관.
 *
 * 로컬 저장이라 gateway를 거치지 않는다. 실제 서버로 옮기게 되면 `MailGateway`에
 * `saveDraft`/`deleteDraft`를 더하고 이 훅의 내부만 바꾼다.
 */
export function useMailDrafts(actor: User | null) {
  return useQuery({
    queryKey: [MAIL_DRAFT_KEY, actor?.id ?? null],
    queryFn: () => draftStore.list(actor?.id ?? ''),
    enabled: actor !== null,
  });
}

function useDraftMutation<TInput, TResult>(mutationFn: (input: TInput) => TResult) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TInput) => mutationFn(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MAIL_DRAFT_KEY] });
      // 임시보관은 폴더 목록에도 건수로 보이므로 목록 조회도 다시 읽는다.
      queryClient.invalidateQueries({ queryKey: [MAIL_INBOX_KEY] });
    },
  });
}

export function useSaveMailDraft() {
  return useDraftMutation(({ actor, draft }: { actor: User; draft: MailDraft }) =>
    draftStore.save(actor.id, draft));
}

export function useRemoveMailDraft() {
  return useDraftMutation(({ actor, id }: { actor: User; id: string }) =>
    draftStore.remove(actor.id, id));
}
