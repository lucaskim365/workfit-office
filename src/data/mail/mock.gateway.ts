import {
  mailAccountDraftSchema,
  mailAccountSchema,
  mailProviderPreset,
  type MailAccount,
  type MailAccountDraft,
} from '@/domain/mailAccount/schema';
import {
  MailError,
  mailRefKey,
  normalizeEmail,
  threadReferences,
  type InboxPage,
} from '@/domain/mail/engine';
import {
  MAIL_FOLDERS,
  MAIL_OUTGOING_TOTAL_MAX,
  mailDetailSchema,
  sendMailInputSchema,
  type MailDetail,
  type MailFolder,
  type MailRef,
  type MailSummary,
  type SendMailInput,
} from '@/domain/mail/schema';
import {
  FAILING_ACCOUNT_IDS,
  MAIL_ACCOUNT_FIXTURE,
  MAIL_DETAIL_FIXTURE,
  UID_VALIDITY,
} from './mail.fixture';
import type {
  MailAttachmentContent,
  MailConnectionResult,
  MailCredential,
  MailGateway,
  MailGatewayContext,
  MailSendResult,
} from './mail.gateway';

/**
 * 로컬 목업 gateway.
 *
 * 외부로 나가는 연결이 하나도 없다. IMAP·SMTP는 브라우저에서 열 수 없는 TCP 프로토콜이라
 * 실제 연동은 서버가 대신해야 하고, 그 서버는 승인 뒤에 붙인다. ([[jwheo/feat/mail/DESIGN.md]] §4)
 *
 * 화면이 실제 사용에서 마주칠 상태를 여기서 만들어 준다 — 응답 지연, 계정별 부분 실패,
 * 빈 편지함. 목업이 항상 즉시·성공으로 답하면 그 화면들은 만들어도 확인할 수가 없다.
 */

const LATENCY = { account: 160, list: 220, detail: 140, send: 320 };

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

interface MockStore {
  accounts: MailAccount[];
  mails: MailDetail[];
  /** 발송 기록. 목업은 실제로 보내지 않으므로 검증과 화면 확인에만 쓴다. */
  sent: { input: SendMailInput; sentAt: string }[];
}

const store: MockStore = {
  accounts: [],
  mails: [],
  sent: [],
};

export function resetMockMailStore(): void {
  store.accounts = MAIL_ACCOUNT_FIXTURE.map((row) => mailAccountSchema.parse(row));
  store.mails = MAIL_DETAIL_FIXTURE.map((row) => mailDetailSchema.parse(row));
  store.sent = [];
}

resetMockMailStore();

export const mockSentMails = (): { input: SendMailInput; sentAt: string }[] => [...store.sent];

/**
 * 소유권 확인.
 *
 * 목업은 전달받은 `workfitUserId`를 쓰지만 실제 gateway는 이 값을 무시하고 인증 토큰의
 * UID로 판정한다. 클라이언트가 보낸 사용자 ID를 신뢰하면 남의 편지함을 열 수 있다. (§4-1)
 */
function requireAccount(ctx: MailGatewayContext, accountId: string): MailAccount {
  const found = store.accounts.find((row) => row.id === accountId);
  if (!found) throw new MailError('NOT_FOUND', '메일 계정을 찾을 수 없습니다.');
  if (found.workfitUserId !== ctx.workfitUserId) {
    throw new MailError('FORBIDDEN', '이 계정에 접근할 권한이 없습니다.');
  }
  return found;
}

/**
 * 로컬에서는 `mock` 자격 증명만 받는다.
 *
 * 실제 앱 비밀번호가 브라우저 메모리에 들어오는 경로를 코드에서 막는다. 화면이 실수로
 * 입력란을 만들더라도 여기서 걸린다. (§4-3 · §4-6)
 */
function assertMockCredential(credential: MailCredential | null): void {
  if (credential === null || credential.kind === 'mock') return;
  throw new MailError(
    'FORBIDDEN',
    '로컬 목업에서는 실제 자격 증명을 사용할 수 없습니다. 운영 연동 승인 후 서버에서 처리합니다.',
  );
}

/** 1차에 열지 않은 공급자는 gateway에서도 막는다. 화면 조건만으로는 우회될 수 있다. */
function assertOpenProvider(draft: MailAccountDraft): void {
  const preset = mailProviderPreset(draft.provider);
  if (!preset.available) {
    throw new MailError('PROVIDER_UNAVAILABLE', preset.unavailableReason ?? '아직 지원하지 않는 공급자입니다.');
  }
}

function assertUniqueEmail(ctx: MailGatewayContext, email: string, exceptId?: string): void {
  const duplicated = store.accounts.some(
    (row) => row.workfitUserId === ctx.workfitUserId && row.email === email && row.id !== exceptId,
  );
  if (duplicated) throw new MailError('INVALID_INPUT', '이미 등록한 메일 주소입니다.');
}

function parseDraft(draft: MailAccountDraft): MailAccountDraft {
  const parsed = mailAccountDraftSchema.safeParse(draft);
  if (!parsed.success) {
    throw new MailError('INVALID_INPUT', parsed.error.issues[0]?.message ?? '입력값을 확인하세요.');
  }
  return { ...parsed.data, email: normalizeEmail(parsed.data.email) };
}

function nextAccountId(): string {
  const max = store.accounts.reduce((value, row) => {
    const parsed = Number(row.id.match(/(\d+)$/)?.[1]);
    return Number.isFinite(parsed) ? Math.max(value, parsed) : value;
  }, 0);
  return `MA-${String(max + 1).padStart(4, '0')}`;
}

const toSummary = (detail: MailDetail): MailSummary => ({
  ref: { ...detail.ref },
  from: { ...detail.from },
  to: detail.to.map((row) => ({ ...row })),
  subject: detail.subject,
  preview: detail.preview,
  receivedAt: detail.receivedAt,
  seen: detail.seen,
  answered: detail.answered,
  flagged: detail.flagged,
  hasAttachment: detail.hasAttachment,
});

/** 조회 실패를 흉내 낼 계정인지. 실제 gateway에서는 IMAP 응답이 이 자리를 대신한다. */
const failureOf = (accountId: string) => FAILING_ACCOUNT_IDS[accountId] ?? null;

export const mockMailGateway: MailGateway = {
  // 연결 테스트는 저장 전 단계라 소유권을 볼 대상이 없다. 실제 gateway도 인증만 확인한다.
  async testConnection(_ctx, draft, credential): Promise<MailConnectionResult> {
    assertMockCredential(credential);
    const parsed = parseDraft(draft);
    assertOpenProvider(parsed);
    await sleep(LATENCY.account);
    return { smtp: { ok: true, code: null }, imap: { ok: true, code: null } };
  },

  async createAccount(ctx, draft, credential): Promise<MailAccount> {
    assertMockCredential(credential);
    const parsed = parseDraft(draft);
    assertOpenProvider(parsed);
    assertUniqueEmail(ctx, parsed.email);
    await sleep(LATENCY.account);

    const preset = mailProviderPreset(parsed.provider);
    const stamp = new Date().toISOString();
    const created = mailAccountSchema.parse({
      id: nextAccountId(),
      workfitUserId: ctx.workfitUserId,
      displayName: parsed.displayName,
      email: parsed.email,
      provider: parsed.provider,
      authType: preset.authType,
      transport: preset.transport,
      status: 'active',
      verifiedAt: stamp,
      signature: parsed.signature,
      lastErrorCode: null,
      createdAt: stamp,
      updatedAt: stamp,
    });
    store.accounts = [...store.accounts, created];
    return { ...created };
  },

  async listAccounts(ctx): Promise<MailAccount[]> {
    await sleep(LATENCY.account);
    return store.accounts
      .filter((row) => row.workfitUserId === ctx.workfitUserId)
      .map((row) => ({ ...row }));
  },

  async updateAccount(ctx, id, draft, credential): Promise<MailAccount> {
    assertMockCredential(credential);
    const current = requireAccount(ctx, id);
    const parsed = parseDraft(draft);
    assertOpenProvider(parsed);
    assertUniqueEmail(ctx, parsed.email, id);
    await sleep(LATENCY.account);

    const preset = mailProviderPreset(parsed.provider);
    const stamp = new Date().toISOString();
    const updated = mailAccountSchema.parse({
      ...current,
      displayName: parsed.displayName,
      email: parsed.email,
      provider: parsed.provider,
      authType: preset.authType,
      transport: preset.transport,
      signature: parsed.signature,
      // 자격 증명을 새로 받았을 때만 오류 상태를 푼다. 주소만 고쳐도 풀리면
      // 연결되지 않은 계정이 정상으로 보인다.
      status: credential !== null ? 'active' : current.status,
      verifiedAt: credential !== null ? stamp : current.verifiedAt,
      lastErrorCode: credential !== null ? null : current.lastErrorCode,
      updatedAt: stamp,
    });
    store.accounts = store.accounts.map((row) => (row.id === id ? updated : row));
    return { ...updated };
  },

  async deleteAccount(ctx, id): Promise<void> {
    requireAccount(ctx, id);
    await sleep(LATENCY.account);
    store.accounts = store.accounts.filter((row) => row.id !== id);
    store.mails = store.mails.filter((row) => row.ref.accountId !== id);
  },

  /**
   * 계정별 받은메일.
   *
   * 실패한 계정은 예외를 던지지 않고 `error`를 담아 돌려준다. 예외로 만들면 한 계정이
   * 죽었을 때 나머지 계정 메일까지 사라진다. ([[DESIGN.md]] §6)
   */
  /** 목업은 계정마다 네 폴더를 모두 갖고 있다고 본다. */
  async listFolders(ctx): Promise<Record<string, MailFolder[]>> {
    await sleep(LATENCY.account);
    return Object.fromEntries(
      store.accounts
        .filter((row) => row.workfitUserId === ctx.workfitUserId)
        .map((row) => [row.id, [...MAIL_FOLDERS]]),
    );
  },

  async listMails(ctx, accountIds, folder, perAccount, query): Promise<InboxPage[]> {
    const targets = accountIds.length > 0
      ? accountIds.map((id) => requireAccount(ctx, id))
      : store.accounts.filter((row) => row.workfitUserId === ctx.workfitUserId);

    await sleep(LATENCY.list);

    // 실제 서버는 IMAP SEARCH로 거른다. 목업도 상한을 적용하기 전에 걸러 같은 순서를 따른다.
    const text = query?.text?.trim().toLowerCase() ?? '';
    const matches = (row: MailDetail) => {
      if (query?.unseenOnly && row.seen) return false;
      if (query?.flaggedOnly && !row.flagged) return false;
      if (!text) return true;
      // 서버와 같은 대상: 제목·보낸사람·받는사람·참조·본문.
      const people = [row.from, ...row.to, ...row.cc].flatMap((who) => [who.name, who.email]);
      return [row.subject, row.textBody, ...people]
        .some((value) => value.toLowerCase().includes(text));
    };

    return targets.map((account) => {
      const failure = failureOf(account.id);
      if (failure) return { accountId: account.id, mails: null, error: failure };

      const mails = store.mails
        .filter((row) => row.ref.accountId === account.id && row.ref.folder === folder)
        .filter(matches)
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
        .slice(0, perAccount)
        .map((row) => {
          const summary = toSummary(row);
          /*
            실제 서버는 보낸메일함에서 발신자 자리에 받는사람을 넣고 진짜 발신자를 `sentBy`로
            따로 보낸다. 목업이 그대로 두면 로컬에서만 다르게 보여 화면을 잘못 고치게 된다.
          */
          if (folder !== 'SENT') return summary;
          return {
            ...summary,
            from: row.to[0] ?? summary.from,
            sentBy: row.from,
          };
        });
      return { accountId: account.id, mails, error: null };
    });
  },

  /**
   * 폴더 간 이동.
   *
   * 같은 폴더로 옮기라는 요청은 조용히 넘긴다 — 오류로 만들면 사용자가 이미 휴지통에 있는
   * 메일을 지우려 했을 때 실패 메시지만 보게 된다.
   */
  /**
   * 첨부 내려받기.
   *
   * 목업에는 실제 파일이 없어 첨부 정보를 담은 작은 텍스트를 만들어 준다. 내려받기 흐름
   * (요청 → blob → 저장)이 화면에서 실제로 동작하는지 확인하는 것이 목적이다.
   */
  async downloadAttachment(ctx, ref, index): Promise<MailAttachmentContent> {
    requireAccount(ctx, ref.accountId);
    if (failureOf(ref.accountId)) throw new MailError('AUTH_FAILED', '첨부를 내려받지 못했습니다.');

    await sleep(LATENCY.detail);
    const mail = store.mails.find((row) => mailRefKey(row.ref) === mailRefKey(ref));
    const found = mail?.attachments[index];
    if (!found) throw new MailError('NOT_FOUND', '첨부를 찾을 수 없습니다.');

    const body = `로컬 목업 첨부입니다.\n파일명: ${found.filename}\n형식: ${found.contentType}\n메일: ${mail?.subject ?? ''}\n`;
    // 크기는 문자 수가 아니라 바이트 수다. 한글은 UTF-8에서 3바이트라 둘이 어긋난다.
    const bytes = new TextEncoder().encode(body);
    const base64 = btoa(String.fromCharCode(...bytes));
    return { filename: found.filename, contentType: 'text/plain', size: bytes.length, base64 };
  },

  async moveMail(ctx, ref, to): Promise<void> {
    requireAccount(ctx, ref.accountId);
    if (failureOf(ref.accountId)) throw new MailError('AUTH_FAILED', '메일을 옮기지 못했습니다.');
    if (ref.folder === to) return;

    await sleep(LATENCY.detail);
    const found = store.mails.find((row) => mailRefKey(row.ref) === mailRefKey(ref));
    if (!found) throw new MailError('NOT_FOUND', '메일을 찾을 수 없습니다.');

    store.mails = store.mails.map((row) =>
      mailRefKey(row.ref) === mailRefKey(ref) ? { ...row, ref: { ...row.ref, folder: to } } : row);
  },

  async getMail(ctx, ref): Promise<MailDetail> {
    requireAccount(ctx, ref.accountId);
    const failure = failureOf(ref.accountId);
    if (failure) throw new MailError(failure, '메일을 불러오지 못했습니다.');

    await sleep(LATENCY.detail);
    const found = store.mails.find((row) => mailRefKey(row.ref) === mailRefKey(ref));
    if (!found) throw new MailError('NOT_FOUND', '메일을 찾을 수 없습니다. 다른 기기에서 지웠을 수 있습니다.');
    return { ...found, to: [...found.to], cc: [...found.cc], references: [...found.references] };
  },

  async markRead(ctx, refs, seen): Promise<void> {
    // 어느 한 계정이라도 실패면 전체를 실패로 알린다. 일부만 바뀐 채 성공으로 보이면
    // 사용자는 남은 안 읽음 표시를 오류가 아니라 새 메일로 오해한다.
    for (const accountId of new Set(refs.map((ref) => ref.accountId))) {
      requireAccount(ctx, accountId);
      const failure = failureOf(accountId);
      if (failure) throw new MailError(failure, '읽음 표시를 반영하지 못했습니다.');
    }

    await sleep(LATENCY.detail);
    const keys = new Set(refs.map(mailRefKey));
    store.mails = store.mails.map((row) =>
      keys.has(mailRefKey(row.ref)) ? { ...row, seen } : row);
  },

  async countUnseen(ctx): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const account of store.accounts.filter((row) => row.workfitUserId === ctx.workfitUserId)) {
      if (failureOf(account.id)) continue;
      counts[account.id] = store.mails
        .filter((row) => row.ref.accountId === account.id && row.ref.folder === 'INBOX' && !row.seen)
        .length;
    }
    return counts;
  },

  async markFlagged(ctx, refs, flagged): Promise<void> {
    for (const accountId of new Set(refs.map((ref) => ref.accountId))) {
      requireAccount(ctx, accountId);
      const failure = failureOf(accountId);
      if (failure) throw new MailError(failure, '중요 표시를 반영하지 못했습니다.');
    }

    await sleep(LATENCY.detail);
    const keys = new Set(refs.map(mailRefKey));
    store.mails = store.mails.map((row) =>
      keys.has(mailRefKey(row.ref)) ? { ...row, flagged } : row);
  },

  /**
   * 발송.
   *
   * 답장이면 원본에 `\Answered`를 다는데, **그 실패는 삼킨다.** 발송은 이미 끝났으므로
   * 플래그 실패로 오류를 돌려주면 사용자가 같은 메일을 다시 보낸다.
   * (MailHub `mail.service.ts`의 `sendReplyMessage`와 같은 판단)
   */
  async sendMail(ctx, input): Promise<MailSendResult> {
    const parsed = sendMailInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new MailError('INVALID_INPUT', parsed.error.issues[0]?.message ?? '입력값을 확인하세요.');
    }
    const sender = requireAccount(ctx, parsed.data.accountId);
    if (failureOf(sender.id)) throw new MailError('SEND_FAILED', '메일을 보내지 못했습니다.');

    // 총량을 넘으면 첨부를 조용히 빼고 보내지 않고 실패로 알린다. 빼고 보내면 받는 쪽은
    // 첨부가 있었다는 사실 자체를 모른다.
    const uploadedBytes = parsed.data.attachments.reduce((sum, file) => sum + file.size, 0);
    if (uploadedBytes > MAIL_OUTGOING_TOTAL_MAX) {
      throw new MailError('INVALID_INPUT', '첨부 총량이 20MB를 넘어 보낼 수 없습니다. 첨부를 줄여 주세요.');
    }

    await sleep(LATENCY.send);
    const sentAt = new Date().toISOString();
    store.sent = [...store.sent, { input: parsed.data, sentAt }];

    const origin = parsed.data.origin;
    const source = origin
      ? store.mails.find((row) => mailRefKey(row.ref) === mailRefKey(origin.ref))
      : undefined;

    // 전달이면 원본 첨부를 그대로 옮긴다. 첨부 없이 전달되면 받는 쪽은 빈 메일을 받는다.
    const forwarded = origin?.mode === 'forward' ? source?.attachments ?? [] : [];
    // 작성 화면에서 올린 첨부는 사본에 메타데이터로 남긴다. 순번은 원본 첨부 뒤에 잇는다.
    const uploaded = parsed.data.attachments.map((file, offset) => ({
      index: forwarded.length + offset,
      filename: file.filename,
      contentType: file.contentType,
      size: file.size,
    }));
    const copies = [...forwarded, ...uploaded];

    // 답장은 원본의 스레드 헤더를 잇는다. 빠지면 받는 쪽에서 새 대화로 뜬다.
    const references = origin && origin.mode !== 'forward' && source
      ? threadReferences(source)
      : [];

    // 보낸메일함에 사본을 남긴다. 발송만 되고 보낸 메일을 볼 수 없으면 반쪽짜리다.
    // 숨은참조는 사본에도 남기지 않는다 — 보낸편지함을 열어 본 사람에게도 노출되면 안 된다.
    const savedTo: MailRef = {
      accountId: sender.id,
      folder: 'SENT',
      uidValidity: mockUidValidity(sender.id),
      uid: nextSentUid(sender.id),
    };
    store.mails = [...store.mails, mailDetailSchema.parse({
      ref: savedTo,
      from: { name: sender.displayName, email: sender.email },
      to: parsed.data.to,
      cc: parsed.data.cc,
      replyTo: null,
      subject: parsed.data.subject,
      preview: parsed.data.textBody.split('\n').find((line) => line.trim() !== '')?.slice(0, 120) ?? '',
      receivedAt: sentAt,
      seen: true,
      answered: false,
      flagged: false,
      hasAttachment: copies.length > 0,
      attachments: copies,
      textBody: parsed.data.textBody,
      htmlBody: null,
      messageId: null,
      references,
      convertedFromHtml: false,
    })];

    // 전달은 원본에 답장 표시를 달지 않는다. 보내지도 않은 사람에게 답한 것으로 보인다.
    if (origin && origin.mode !== 'forward') {
      try {
        requireAccount(ctx, origin.ref.accountId);
        if (failureOf(origin.ref.accountId)) throw new MailError('AUTH_FAILED', '플래그 반영 실패');
        store.mails = store.mails.map((row) =>
          mailRefKey(row.ref) === mailRefKey(origin.ref) ? { ...row, answered: true } : row);
      } catch {
        // 발송은 성공했다. 플래그를 못 달았다고 실패로 돌려주지 않는다.
      }
    }

    return { savedTo, sentAt };
  },
};

/** 보낸메일함 UID. 계정 안에서만 고유하면 된다. */
function nextSentUid(accountId: string): string {
  const used = store.mails
    .filter((row) => row.ref.accountId === accountId && row.ref.folder === 'SENT')
    .map((row) => Number(row.ref.uid));
  return String((used.length > 0 ? Math.max(...used) : 9000) + 1);
}

/** 목업에서 계정의 IMAP 세대를 조회한다. 새 계정은 등록 시각을 세대로 쓴다. */
export const mockUidValidity = (accountId: string): string =>
  UID_VALIDITY[accountId] ?? '1754000000';

export type { MailRef };
