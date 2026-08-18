import { mailAccountDraftSchema, type MailAccount } from '@/domain/mailAccount/schema';
import { MailError, mailRefKey, type InboxPage, type MailErrorCode } from '@/domain/mail/engine';
import type { MailDetail, MailFolder, MailRef, MailSummary } from '@/domain/mail/schema';
import type {
  MailAttachmentContent,
  MailConnectionResult,
  MailGateway,
  MailGatewayContext,
  MailSendResult,
} from './mail.gateway';

/**
 * MailHub 개발 브리지 gateway.
 *
 * WorkfitOffice는 Vite + React 정적 프런트라 Node 런타임이 없고, IMAP/SMTP는 브라우저에서
 * 열 수 없는 TCP 프로토콜이다. 이미 동작하는 MailHub(Next.js) 서버를 개발·시연용 백엔드로
 * 빌려 실제 메일을 읽고 보낸다. ([[jwheo/feat/mail/DESIGN.md]] §14-⑨)
 *
 * **운영 배포에는 쓰지 않는다.** 배포된 프런트는 개발자 PC의 localhost에 닿을 수 없다.
 * 운영은 Firebase Functions든 사내 서버든 승인 후 별도로 붙인다.
 */

const BRIDGE_URL = import.meta.env.VITE_MAILHUB_BRIDGE_URL as string | undefined;
const BRIDGE_TOKEN = import.meta.env.VITE_MAILHUB_BRIDGE_TOKEN as string | undefined;

export const isMailHubBridgeConfigured = Boolean(BRIDGE_URL && BRIDGE_TOKEN);

/** 브리지가 돌려주는 오류 코드를 도메인 코드로 옮긴다. 모르는 값은 공급자 장애로 본다. */
const ERROR_MAP: Record<string, MailErrorCode> = {
  UNAUTHORIZED: 'FORBIDDEN',
  BRIDGE_DISABLED: 'PROVIDER_UNAVAILABLE',
  BRIDGE_USER_UNRESOLVED: 'PROVIDER_UNAVAILABLE',
  NOT_FOUND: 'PROVIDER_UNAVAILABLE',
  MESSAGE_NOT_FOUND: 'NOT_FOUND',
  ACCOUNT_NOT_FOUND: 'NOT_FOUND',
  NO_RECIPIENT: 'INVALID_INPUT',
  ATTACHMENT_TOO_LARGE: 'INVALID_INPUT',
  FORWARD_ATTACHMENT_TOO_LARGE: 'INVALID_INPUT',
  INVALID_INDEX: 'INVALID_INPUT',
  UNKNOWN_FOLDER: 'INVALID_INPUT',
  ATTACHMENT_NOT_FOUND: 'NOT_FOUND',
  MOVE_REJECTED: 'PROVIDER_UNAVAILABLE',
  SEND_AUTH_FAILED: 'AUTH_FAILED',
  SEND_RECIPIENT_REJECTED: 'INVALID_INPUT',
  SEND_TIMEOUT: 'TIMEOUT',
  SEND_TOO_LARGE: 'INVALID_INPUT',
  SEND_ATTACHMENT_TOO_LARGE: 'INVALID_INPUT',
  SEND_FAILED: 'SEND_FAILED',
  INVALID_JSON: 'INVALID_INPUT',
  UNKNOWN_ACTION: 'INVALID_INPUT',
  UPSTREAM_FAILED: 'PROVIDER_UNAVAILABLE',
};

/** 사용자가 손쓸 수 있는 상황은 무슨 일인지 알려준다. 나머지는 일반 안내로 둔다. */
const BRIDGE_MESSAGES: Record<string, string> = {
  ATTACHMENT_TOO_LARGE: '첨부가 너무 커서 내려받을 수 없습니다. 메일 서비스에서 직접 받으세요.',
  FORWARD_ATTACHMENT_TOO_LARGE: '원본 첨부가 너무 커서 전달할 수 없습니다. 첨부를 내려받아 새 메일로 보내세요.',
  ATTACHMENT_NOT_FOUND: '첨부를 찾을 수 없습니다. 메일이 지워졌을 수 있습니다.',
  MESSAGE_NOT_FOUND: '메일을 찾을 수 없습니다. 다른 기기에서 지웠을 수 있습니다.',
  MOVE_REJECTED: '메일을 옮기지 못했습니다. 대상 폴더가 없을 수 있습니다.',
  NO_RECIPIENT: '받는 사람을 입력하세요.',
  SEND_RECIPIENT_REJECTED: '받는 사람 주소를 메일 서버가 거절했습니다. 주소를 확인하세요.',
  SEND_TOO_LARGE: '메일이 너무 커서 보낼 수 없습니다. 첨부를 줄여 주세요.',
  SEND_ATTACHMENT_TOO_LARGE: '첨부 총량이 20MB를 넘어 보낼 수 없습니다. 첨부를 줄여 주세요.',
};

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!BRIDGE_URL || !BRIDGE_TOKEN) {
    throw new MailError('PROVIDER_UNAVAILABLE', '메일 브리지가 설정되지 않았습니다.');
  }

  let response: Response;
  try {
    response = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bridge-token': BRIDGE_TOKEN },
      body: JSON.stringify({ action, payload }),
    });
  } catch {
    // 브리지가 꺼져 있거나 포트가 다르면 여기로 온다. 흔한 상황이라 안내를 구체적으로 준다.
    throw new MailError('PROVIDER_UNAVAILABLE', 'MailHub 브리지에 연결하지 못했습니다. 서버가 떠 있는지 확인하세요.');
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = String(body.error ?? '');
    const code = ERROR_MAP[raw] ?? 'PROVIDER_UNAVAILABLE';
    throw new MailError(code, BRIDGE_MESSAGES[raw] ?? '메일 서버 요청을 처리하지 못했습니다.');
  }
  return body.data as T;
}

/* ------------------------------------------------------------------ 서명 로컬 저장 */

/**
 * 브리지는 계정 관리를 지원하지 않아 서명을 올릴 서버가 없다. 계정별 서명을 이
 * 브라우저의 localStorage에 두고, 계정 목록을 만들 때 입혀 준다. 기기를 옮기면
 * 서명도 따라가지 않는다 — 운영 Functions 이식 때 서버 저장으로 바뀐다.
 */
const SIGNATURE_STORE_KEY = 'workfit.mail.signatures';

function readSignatures(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SIGNATURE_STORE_KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

function localSignature(accountId: string): string {
  const value = readSignatures()[accountId];
  return typeof value === 'string' ? value : '';
}

function saveLocalSignature(accountId: string, signature: string): void {
  const next = readSignatures();
  if (signature) next[accountId] = signature;
  else delete next[accountId];
  try {
    localStorage.setItem(SIGNATURE_STORE_KEY, JSON.stringify(next));
  } catch {
    /* 저장 공간 부족 등 — 서명은 편의 기능이라 조용히 둔다. */
  }
}

/* ------------------------------------------------------------------ 응답 변환 */

interface BridgeAccount {
  id: string;
  provider: string;
  email: string;
  verifiedAt: number | string | null;
}

interface BridgeSummary {
  id: string;
  mailAccountId: string;
  accountEmail: string;
  provider: string;
  uidValidity: string;
  uid: number;
  subject: string;
  senderAddress?: string;
  senderName?: string;
  recipients?: BridgeAddress[];
  receivedAt: string;
  seen: boolean;
  answered?: boolean;
  flagged?: boolean;
  hasAttachment?: boolean;
}

interface BridgeAddress { address?: string; name?: string }

interface BridgeAttachment {
  index: number;
  filename: string;
  contentType: string;
  size: number;
}

interface BridgeDetail {
  mailAccountId: string;
  uidValidity: string;
  uid: number;
  subject: string;
  from: BridgeAddress[];
  to: BridgeAddress[];
  cc: BridgeAddress[];
  replyTo: BridgeAddress[];
  receivedAt: string | null;
  text: string;
  sanitizedHtml?: string | null;
  messageId?: string;
  references?: string | string[];
  attachments?: BridgeAttachment[];
}

const PROVIDER_MAP: Record<string, MailAccount['provider']> = {
  naver: 'naver',
  daum: 'daum',
  custom: 'custom',
};

const toAddress = (row: BridgeAddress | undefined) => ({
  name: row?.name ?? '',
  email: (row?.address ?? '').toLowerCase(),
});

const stamp = (value: number | string | null | undefined): string =>
  value ? new Date(value).toISOString() : new Date(0).toISOString();

function toAccount(row: BridgeAccount, ctx: MailGatewayContext): MailAccount {
  return {
    id: row.id,
    workfitUserId: ctx.workfitUserId,
    // MailHub은 표시 이름을 따로 저장하지 않는다. 주소 앞부분을 임시 이름으로 쓴다.
    displayName: row.email.split('@')[0],
    email: row.email.toLowerCase(),
    provider: PROVIDER_MAP[row.provider] ?? 'custom',
    authType: 'app_password',
    transport: 'imap_smtp',
    status: row.verifiedAt ? 'active' : 'error',
    verifiedAt: row.verifiedAt ? stamp(row.verifiedAt) : null,
    signature: localSignature(row.id),
    lastErrorCode: null,
    createdAt: stamp(row.verifiedAt),
    updatedAt: stamp(row.verifiedAt),
  };
}

/**
 * 목록 항목 변환.
 *
 * 미리보기만 비운다. 본문 앞부분을 얻으려면 메일마다 본문을 내려받아야 해서 목록 조회가
 * 크게 느려진다. 받는 사람·첨부·답장 여부는 `ENVELOPE`·`FLAGS`·`BODYSTRUCTURE`로 본문
 * 없이 얻을 수 있어 채운다. 없는 값을 지어내지 않는다 — 실제와 다르면 찾기가 더 어렵다.
 */
function toSummary(row: BridgeSummary, folder: MailFolder): MailSummary {
  return {
    ref: {
      accountId: row.mailAccountId,
      folder,
      uidValidity: row.uidValidity,
      uid: String(row.uid),
    },
    from: { name: row.senderName ?? '', email: (row.senderAddress ?? '').toLowerCase() },
    to: (row.recipients ?? []).map(toAddress).filter((address) => address.email !== ''),
    subject: row.subject,
    preview: '',
    receivedAt: row.receivedAt,
    seen: row.seen,
    answered: row.answered ?? false,
    flagged: row.flagged ?? false,
    hasAttachment: row.hasAttachment ?? false,
  };
}

function toDetail(row: BridgeDetail, folder: MailFolder): MailDetail {
  const references = Array.isArray(row.references)
    ? row.references
    : row.references ? [row.references] : [];
  return {
    ref: {
      accountId: row.mailAccountId,
      folder,
      uidValidity: row.uidValidity,
      uid: String(row.uid),
    },
    from: toAddress(row.from[0]),
    to: row.to.map(toAddress).filter((address) => address.email !== ''),
    cc: row.cc.map(toAddress).filter((address) => address.email !== ''),
    replyTo: row.replyTo.length > 0 ? toAddress(row.replyTo[0]) : null,
    subject: row.subject,
    preview: row.text.split('\n').find((line) => line.trim() !== '')?.slice(0, 120) ?? '',
    receivedAt: row.receivedAt ?? new Date(0).toISOString(),
    seen: true,
    answered: false,
    // 상세 조회는 플래그를 싣지 않는다. 별표 상태는 목록 요약이 가진 값을 쓴다.
    flagged: false,
    hasAttachment: (row.attachments ?? []).length > 0,
    attachments: row.attachments ?? [],
    textBody: row.text,
    // 서버가 정화한 HTML만 온다. 구버전 브리지 응답에는 없을 수 있어 null로 다룬다.
    htmlBody: row.sanitizedHtml ?? null,
    messageId: row.messageId ?? null,
    references,
    // MailHub은 HTML 원문을 파싱해 텍스트로 넘긴다. 어느 쪽이었는지는 알려주지 않는다.
    convertedFromHtml: false,
  };
}

/** 브리지가 지원하지 않는 동작. 계정 등록·수정은 MailHub에서 한다. */
function unsupported(what: string): never {
  throw new MailError(
    'FORBIDDEN',
    `${what}은(는) 개발 브리지에서 지원하지 않습니다. MailHub에서 처리하세요.`,
  );
}

export const mailHubGateway: MailGateway = {
  async testConnection(): Promise<MailConnectionResult> {
    return unsupported('연결 테스트');
  },
  async createAccount() { return unsupported('계정 등록'); },

  /**
   * 브리지에서 계정 자체(주소·자격 증명)는 못 고친다. 서명만 로컬에 저장한다.
   * 화면도 서명 전용 모달만 열므로 draft의 다른 필드는 계정 원본 그대로 온다.
   */
  async updateAccount(ctx, id, draft): Promise<MailAccount> {
    const rows = await call<BridgeAccount[]>('listAccounts');
    const row = rows.find((item) => item.id === id);
    if (!row) throw new MailError('NOT_FOUND', '계정을 찾을 수 없습니다.');
    saveLocalSignature(id, mailAccountDraftSchema.shape.signature.parse(draft.signature));
    return toAccount(row, ctx);
  },

  async deleteAccount() { return unsupported('계정 삭제'); },

  async listAccounts(ctx): Promise<MailAccount[]> {
    const rows = await call<BridgeAccount[]>('listAccounts');
    return rows.map((row) => toAccount(row, ctx));
  },

  /**
   * 받은메일.
   *
   * 브리지는 계정별 페이지가 아니라 합쳐진 목록과 실패 계정을 준다. 화면 계약에 맞춰
   * 계정별로 다시 나눈다. 실패 계정은 메일이 없는 계정과 구분되어야 한다.
   */
  async listFolders(): Promise<Record<string, MailFolder[]>> {
    return call<Record<string, MailFolder[]>>('listFolders');
  },

  async countUnseen(): Promise<Record<string, number>> {
    return call<Record<string, number>>('unseenCount');
  },

  async listMails(_ctx, accountIds, folder, perAccount, query): Promise<InboxPage[]> {
    const result = await call<{
      messages: BridgeSummary[];
      failures: { mailAccountId: string }[];
    }>('listInbox', {
      folder,
      limit: perAccount,
      ...(query?.text ? { query: query.text } : {}),
      ...(query?.unseenOnly ? { unseenOnly: true } : {}),
      ...(query?.flaggedOnly ? { flaggedOnly: true } : {}),
      ...(accountIds.length === 1 ? { accountId: accountIds[0] } : {}),
    });

    const wanted = accountIds.length > 0
      ? accountIds
      : [...new Set([
        ...result.messages.map((row) => row.mailAccountId),
        ...result.failures.map((row) => row.mailAccountId),
      ])];

    const failed = new Set(result.failures.map((row) => row.mailAccountId));
    return wanted.map((accountId) => {
      if (failed.has(accountId)) {
        return { accountId, mails: null, error: 'PROVIDER_UNAVAILABLE' as MailErrorCode };
      }
      return {
        accountId,
        mails: result.messages
          .filter((row) => row.mailAccountId === accountId)
          .map((row) => toSummary(row, folder)),
        error: null,
      };
    });
  },

  async getMail(_ctx, ref): Promise<MailDetail> {
    const row = await call<BridgeDetail>('getMessage', {
      folder: ref.folder,
      accountId: ref.accountId,
      uidValidity: ref.uidValidity,
      uid: Number(ref.uid),
    });
    return toDetail(row, ref.folder);
  },

  async downloadAttachment(_ctx, ref, index): Promise<MailAttachmentContent> {
    return call<MailAttachmentContent>('getAttachment', {
      folder: ref.folder,
      accountId: ref.accountId,
      uidValidity: ref.uidValidity,
      uid: Number(ref.uid),
      index,
    });
  },

  async moveMail(_ctx, ref, to): Promise<void> {
    await call<{ moved: boolean }>('moveMail', {
      accountId: ref.accountId,
      uidValidity: ref.uidValidity,
      uid: Number(ref.uid),
      from: ref.folder,
      to,
    });
  },

  /**
   * 읽음·안 읽음 표시.
   *
   * 열 때는 상세 조회가 `\Seen`을 함께 달아 이 호출이 겹치지만, "단건이면 건너뛴다" 같은
   * 추측은 하지 않는다 — 모두 읽음 대상이 마침 1건이면 조용히 빠진다. 겹침 비용은 IMAP
   * `STORE` 한 번이다. 폴더가 다른 식별자가 섞이면 폴더별로 묶어 보낸다.
   */
  async markRead(_ctx, refs, seen): Promise<void> {
    const byFolder = new Map<MailFolder, MailRef[]>();
    for (const ref of refs) {
      byFolder.set(ref.folder, [...(byFolder.get(ref.folder) ?? []), ref]);
    }
    for (const [folder, group] of byFolder) {
      await call<{ updated: number }>('markSeen', {
        folder,
        seen,
        refs: group.map((ref) => ({
          accountId: ref.accountId,
          uidValidity: ref.uidValidity,
          uid: Number(ref.uid),
        })),
      });
    }
  },

  /** 별표(중요) 표시. 읽음과 같은 규칙으로 폴더별로 묶어 보낸다. */
  async markFlagged(_ctx, refs, flagged): Promise<void> {
    const byFolder = new Map<MailFolder, MailRef[]>();
    for (const ref of refs) {
      byFolder.set(ref.folder, [...(byFolder.get(ref.folder) ?? []), ref]);
    }
    for (const [folder, group] of byFolder) {
      await call<{ updated: number }>('markFlagged', {
        folder,
        flagged,
        refs: group.map((ref) => ({
          accountId: ref.accountId,
          uidValidity: ref.uidValidity,
          uid: Number(ref.uid),
        })),
      });
    }
  },

  async sendMail(_ctx, input): Promise<MailSendResult> {
    const format = (rows: { name: string; email: string }[]) =>
      rows.map((row) => (row.name ? `${row.name} <${row.email}>` : row.email));

    // 원본 참조를 함께 보낸다. 서버가 원문을 다시 읽어 스레드 헤더를 만들고, 전달이면
    // 원문 첨부를 실어 보낸다. 이걸 빼면 답장이 받는 쪽에서 새 대화로 뜬다.
    const result = await call<{ sentAt: string; attachmentCount?: number }>('sendMail', {
      accountId: input.accountId,
      to: format(input.to),
      cc: format(input.cc),
      bcc: format(input.bcc),
      subject: input.subject,
      textBody: input.textBody,
      // 작성 화면에서 올린 첨부. 멀티파트 구성은 서버가 한다. `size`는 클라이언트 검증용
      // 값이라 싣지 않는다 — 서버는 어차피 풀어본 바이트 수로 다시 검사한다.
      ...(input.attachments.length > 0
        ? {
          attachments: input.attachments.map((file) => ({
            filename: file.filename,
            contentType: file.contentType,
            base64: file.base64,
          })),
        }
        : {}),
      ...(input.origin
        ? {
          origin: {
            mode: input.origin.mode,
            folder: input.origin.ref.folder,
            accountId: input.origin.ref.accountId,
            uidValidity: input.origin.ref.uidValidity,
            uid: Number(input.origin.ref.uid),
          },
        }
        : {}),
    });
    return { savedTo: null, sentAt: result.sentAt };
  },
};

export const mailHubRefKey = mailRefKey;
export type { MailRef };
