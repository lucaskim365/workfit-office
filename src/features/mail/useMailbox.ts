import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@/domain/user/schema';
import { mailRefKey, mergeInboxPages } from '@/domain/mail/engine';
import {
  MAIL_FETCH_PER_ACCOUNT,
  MAIL_FETCH_TOTAL,
  type MailFolder,
  type MailRef,
  type SendMailInput,
} from '@/domain/mail/schema';
import { mailGateway } from '@/data/mail/mail.client';
import type { MailQuery } from '@/data/mail/mail.gateway';
import {
  MAIL_ACCOUNT_KEY,
  MAIL_DETAIL_KEY,
  MAIL_FOLDER_KEY,
  MAIL_INBOX_KEY,
  mailContext,
} from './useMailAccounts';

/**
 * 통합 받은메일.
 *
 * 자동 폴링을 걸지 않는다. 사용자가 화면을 열어둔 채 자리를 비워도 계속 IMAP에 접속하면
 * 서버 실행 시간이 그대로 비용이 되고, 설계도 IMAP IDLE과 푸시를 1차 제외로 뒀다.
 * 새로고침은 사용자가 누를 때만 한다. ([[jwheo/feat/mail/DESIGN.md]] §3 제외)
 *
 * `retry`도 끈다. 인증 실패는 다시 시도해도 결과가 같고 왕복 비용만 늘어난다.
 */
export function useInbox(
  actor: User | null,
  accountIds: string[],
  folder: MailFolder = 'INBOX',
  query: MailQuery = {},
  /** 계정당 조회 상한. `더 보기`가 이 값을 키운다. */
  perAccount: number = MAIL_FETCH_PER_ACCOUNT,
) {
  const key = [...accountIds].sort();
  const text = query.text?.trim() ?? '';
  const unseenOnly = query.unseenOnly ?? false;
  const flaggedOnly = query.flaggedOnly ?? false;
  return useQuery({
    queryKey: [MAIL_INBOX_KEY, actor?.id ?? null, folder, key, text, unseenOnly, flaggedOnly, perAccount],
    queryFn: async () => {
      const pages = await mailGateway.listMails(
        mailContext(actor as User),
        key,
        folder,
        perAccount,
        { text, unseenOnly, flaggedOnly },
      );
      return mergeInboxPages(pages, MAIL_FETCH_TOTAL);
    },
    enabled: actor !== null,
    retry: false,
  });
}

/**
 * 계정별로 실제 존재하는 폴더.
 *
 * 실제 IMAP 조회라 느리고 자주 바뀌지 않는다. 계정 목록이 바뀔 때만 다시 읽는다.
 */
export function useMailFolders(actor: User | null, accountIds: string[]) {
  return useQuery({
    queryKey: [MAIL_FOLDER_KEY, actor?.id ?? null, [...accountIds].sort()],
    queryFn: () => mailGateway.listFolders(mailContext(actor as User)),
    enabled: actor !== null,
    retry: false,
    staleTime: 10 * 60_000,
  });
}

/**
 * 폴더 이동(휴지통·복원). 복수 식별자를 받아 일괄 처리한다.
 *
 * 낙관적 갱신을 하지 않는다. 실패해도 화면에서 사라진 채로 남으면 사용자는 지워졌다고
 * 믿는데 실제로는 남아 있다.
 *
 * 단건은 오류를 그대로 던져 호출부가 코드별 안내를 보여준다. 여러 건은 항목마다
 * 성공·실패를 세서 돌려준다 — 30건 중 한 건 실패로 전체를 실패로 알리면 이미 옮겨진
 * 29건을 설명할 수 없다. 무효화는 마지막에 한 번만 해 목록 재조회가 건수만큼 반복되지
 * 않게 한다.
 */
export function useMoveMail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ actor, refs, to }: { actor: User; refs: MailRef[]; to: MailFolder }) => {
      if (refs.length === 1) {
        await mailGateway.moveMail(mailContext(actor), refs[0], to);
        return { moved: 1, failed: 0 };
      }
      let moved = 0;
      let failed = 0;
      for (const ref of refs) {
        try {
          await mailGateway.moveMail(mailContext(actor), ref, to);
          moved += 1;
        } catch {
          failed += 1;
        }
      }
      return { moved, failed };
    },
    onSettled: () => {
      // 일부만 성공해도 옮겨진 것은 옮겨졌다. 성공 여부와 무관하게 다시 읽는다.
      queryClient.invalidateQueries({ queryKey: [MAIL_INBOX_KEY] });
      queryClient.invalidateQueries({ queryKey: [MAIL_DETAIL_KEY] });
    },
  });
}

export function useMailDetail(actor: User | null, ref: MailRef | null) {
  return useQuery({
    queryKey: [MAIL_DETAIL_KEY, actor?.id ?? null, ref ? mailRefKey(ref) : null],
    queryFn: () => mailGateway.getMail(mailContext(actor as User), ref as MailRef),
    enabled: actor !== null && ref !== null,
    retry: false,
  });
}

/**
 * 읽음·안 읽음 표시. 복수 식별자를 받아 일괄 처리한다.
 *
 * 열 때의 읽음 표시 실패는 화면에 오류를 띄우지 않는다 — 메일은 이미 열려 있고 사용자가
 * 할 수 있는 일이 없다. 모두 읽음·안 읽음 되돌리기는 호출하는 쪽이 실패를 알린다.
 */
export function useMarkMailRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actor, refs, seen }: { actor: User; refs: MailRef[]; seen: boolean }) =>
      mailGateway.markRead(mailContext(actor), refs, seen),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MAIL_INBOX_KEY] });
      queryClient.invalidateQueries({ queryKey: [MAIL_DETAIL_KEY] });
    },
  });
}

/**
 * 받은메일함 안 읽은 수.
 *
 * `MAIL_INBOX_KEY` 아래에 둬서 읽음·이동·발송이 목록을 무효화할 때 함께 다시 읽힌다.
 * 별도 키면 배지만 옛 숫자로 남는다.
 */
export function useUnseenCount(actor: User | null) {
  return useQuery({
    queryKey: [MAIL_INBOX_KEY, 'unseen-count', actor?.id ?? null],
    queryFn: () => mailGateway.countUnseen(mailContext(actor as User)),
    enabled: actor !== null,
    retry: false,
    staleTime: 60_000,
  });
}

/**
 * 별표(중요) 표시. 서버 `\Flagged`라 다른 클라이언트에서 단 별표와 함께 움직인다.
 */
export function useMarkFlagged() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actor, refs, flagged }: { actor: User; refs: MailRef[]; flagged: boolean }) =>
      mailGateway.markFlagged(mailContext(actor), refs, flagged),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MAIL_INBOX_KEY] });
    },
  });
}

/**
 * 첨부 내려받기.
 *
 * 캐시하지 않는다. 한 번 받으면 그만이고, react-query 캐시에 남기면 큰 파일이 메모리에
 * 계속 떠 있게 된다.
 */
export function useDownloadAttachment() {
  return useMutation({
    mutationFn: ({ actor, ref, index }: { actor: User; ref: MailRef; index: number }) =>
      mailGateway.downloadAttachment(mailContext(actor), ref, index),
  });
}

/** base64 응답을 파일로 저장한다. 브라우저가 할 수 있는 유일한 방법이다. */
export function saveAttachment(content: { filename: string; contentType: string; base64: string }): void {
  const binary = atob(content.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  const url = URL.createObjectURL(new Blob([bytes], { type: content.contentType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = content.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 즉시 해제하면 저장이 시작되기 전에 끊길 수 있어 다음 틱으로 미룬다.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function useSendMail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actor, input }: { actor: User; input: SendMailInput }) =>
      mailGateway.sendMail(mailContext(actor), input),
    onSuccess: () => {
      // 답장이면 원본에 답장 표시가 붙으므로 목록·상세를 다시 읽는다.
      queryClient.invalidateQueries({ queryKey: [MAIL_INBOX_KEY] });
      queryClient.invalidateQueries({ queryKey: [MAIL_DETAIL_KEY] });
      queryClient.invalidateQueries({ queryKey: [MAIL_ACCOUNT_KEY] });
    },
  });
}
