import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@/domain/user/schema';
import type { MailAccountDraft } from '@/domain/mailAccount/schema';
import { mailGateway } from '@/data/mail/mail.client';
import type { MailCredential, MailGatewayContext } from '@/data/mail/mail.gateway';

export const MAIL_ACCOUNT_KEY = 'gw-mail-accounts';
export const MAIL_INBOX_KEY = 'gw-mail-inbox';
export const MAIL_DETAIL_KEY = 'gw-mail-detail';
export const MAIL_FOLDER_KEY = 'gw-mail-folders';

/**
 * 호출자 정보.
 *
 * 실제 gateway는 이 값을 무시하고 인증 토큰의 UID를 쓴다. 화면이 넘기는 사용자 ID는
 * 로컬 목업에서만 의미가 있다. ([[jwheo/feat/mail/DESIGN.md]] §4-1)
 */
export const mailContext = (actor: User): MailGatewayContext => ({ workfitUserId: actor.id });

/** 로컬 범위에서 쓸 수 있는 유일한 자격 증명. */
export const MOCK_CREDENTIAL: MailCredential = { kind: 'mock' };

export function useMailAccounts(actor: User | null) {
  return useQuery({
    queryKey: [MAIL_ACCOUNT_KEY, actor?.id ?? null],
    queryFn: () => mailGateway.listAccounts(mailContext(actor as User)),
    enabled: actor !== null,
  });
}

/** 계정 변경은 받은메일 구성까지 바꾸므로 목록·상세를 함께 무효화한다. */
function useMailAccountMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MAIL_ACCOUNT_KEY] });
      queryClient.invalidateQueries({ queryKey: [MAIL_INBOX_KEY] });
      queryClient.invalidateQueries({ queryKey: [MAIL_DETAIL_KEY] });
    },
  });
}

export function useTestMailConnection() {
  return useMutation({
    mutationFn: ({ actor, draft }: { actor: User; draft: MailAccountDraft }) =>
      mailGateway.testConnection(mailContext(actor), draft, MOCK_CREDENTIAL),
  });
}

export function useCreateMailAccount() {
  return useMailAccountMutation(({ actor, draft }: { actor: User; draft: MailAccountDraft }) =>
    mailGateway.createAccount(mailContext(actor), draft, MOCK_CREDENTIAL));
}

export function useUpdateMailAccount() {
  return useMailAccountMutation(({ actor, id, draft, credential }: {
    actor: User;
    id: string;
    draft: MailAccountDraft;
    /** null이면 자격 증명을 바꾸지 않는다는 뜻이고 오류 상태도 그대로 둔다. */
    credential: MailCredential | null;
  }) => mailGateway.updateAccount(mailContext(actor), id, draft, credential));
}

export function useDeleteMailAccount() {
  return useMailAccountMutation(({ actor, id }: { actor: User; id: string }) =>
    mailGateway.deleteAccount(mailContext(actor), id));
}
