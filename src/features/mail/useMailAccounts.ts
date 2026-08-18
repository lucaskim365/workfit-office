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

/** 자격 증명을 받지 않는 목업용 값. 실제 등록은 화면이 `app_password`를 넘긴다. */
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

/**
 * 연결 테스트.
 *
 * 자격 증명을 화면에서 받는다. 앱 비밀번호는 서버가 IMAP·SMTP 인증에 그대로 써야 해서
 * 입력 시점에 한 번은 브라우저를 거칠 수밖에 없다 — 대신 계정 도메인(`MailAccount`)과
 * 저장 상태에는 담기지 않고, 요청 본문으로만 지나간다.
 */
export function useTestMailConnection() {
  return useMutation({
    mutationFn: ({ actor, draft, credential }: {
      actor: User;
      draft: MailAccountDraft;
      credential: MailCredential;
    }) => mailGateway.testConnection(mailContext(actor), draft, credential),
  });
}

export function useCreateMailAccount() {
  return useMailAccountMutation(({ actor, draft, credential }: {
    actor: User;
    draft: MailAccountDraft;
    credential: MailCredential;
  }) => mailGateway.createAccount(mailContext(actor), draft, credential));
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
