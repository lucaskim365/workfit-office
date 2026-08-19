import type { MailAccount, MailAccountDraft } from '@/domain/mailAccount/schema';
import { MailError, type InboxPage, type MailErrorCode } from '@/domain/mail/engine';
import type { MailDetail, MailFolder, MailRef } from '@/domain/mail/schema';
import { Functions } from 'appwrite';
import { client } from '@/shared/lib/appwrite';
import { getWiddyToken } from '@/data/widdyChat/widdyAuth';
import type {
  MailAttachmentContent,
  MailConnectionResult,
  MailCredential,
  MailGateway,
  MailSendResult,
} from './mail.gateway';

/**
 * Appwrite Function gateway — 운영 경로.
 *
 * WorkfitOffice는 Vite + React 정적 프런트라 Node 런타임이 없고, IMAP·SMTP는 브라우저에서
 * 열 수 없는 TCP 프로토콜이다. `appwrite/functions/mail` Function이 그 일을 대신한다.
 * MailHub 개발 브리지를 대체한다.
 *
 * **신원**: 요청 본문에 사용자 ID를 싣지 않는다. 로그인할 때 발급받아 둔 서명 토큰만 보내고,
 * Function이 서명을 검증해 uid를 도출한다. 브라우저가 uid를 주장할 수 없어야 남의 메일함이
 * 열리지 않는다.
 */

const FUNCTION_ID = (import.meta.env.VITE_MAIL_FUNCTION_ID as string | undefined) || 'mail';

/** Function이 붙어 있는지. Appwrite 미설정이면 화면은 메일 기능을 열지 않는다. */
export const isAppwriteMailConfigured = Boolean(client);

/** Function 오류 코드 → 도메인 코드. 모르는 값은 공급자 장애로 본다. */
const ERROR_MAP: Record<string, MailErrorCode> = {
  UNAUTHORIZED: 'FORBIDDEN',
  SERVER_NOT_CONFIGURED: 'PROVIDER_UNAVAILABLE',
  INVALID_INPUT: 'INVALID_INPUT',
  DUPLICATE: 'INVALID_INPUT',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  NOT_FOUND: 'NOT_FOUND',
  UNKNOWN_ACTION: 'INVALID_INPUT',
  INTERNAL: 'PROVIDER_UNAVAILABLE',
  // 연결 확인 단계에서 나오는 코드들
  AUTH_FAILED: 'AUTH_FAILED',
  TIMEOUT: 'TIMEOUT',
  TLS_FAILED: 'TLS_FAILED',
  UNREACHABLE: 'PROVIDER_UNAVAILABLE',
  CONNECT_FAILED: 'PROVIDER_UNAVAILABLE',
};

interface FnError {
  code: string;
  message: string;
}

/**
 * Function 호출.
 *
 * 토큰이 없으면 아예 보내지 않는다. Widdy는 토큰이 없으면 익명으로 강등되지만 메일은
 * 익명으로 열 수 있는 것이 없다 — 다시 로그인하라고 알리는 편이 낫다.
 */
async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!client) {
    throw new MailError('PROVIDER_UNAVAILABLE', '메일 서버가 설정되지 않았습니다.');
  }

  const token = getWiddyToken();
  if (!token) {
    throw new MailError(
      'FORBIDDEN',
      '로그인 정보가 만료되었습니다. 로그아웃 후 다시 로그인해 주세요.',
    );
  }

  let body: { data?: T; error?: FnError };
  try {
    const execution = await new Functions(client).createExecution(
      FUNCTION_ID,
      JSON.stringify({ token, action, payload }),
      false,
    );
    body = JSON.parse(execution.responseBody || '{}');
  } catch {
    // Function 미배포·네트워크 단절·응답이 JSON이 아닌 경우가 모두 여기로 온다.
    throw new MailError('PROVIDER_UNAVAILABLE', '메일 서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');
  }

  if (body.error) {
    const code = ERROR_MAP[body.error.code] ?? 'PROVIDER_UNAVAILABLE';
    throw new MailError(code, body.error.message || '메일 서버 요청을 처리하지 못했습니다.');
  }
  return body.data as T;
}

/**
 * 자격 증명 → 요청에 실을 앱 비밀번호.
 *
 * `mock`은 값이 없다는 뜻이라 그대로 흘려보낸다(수정 시 "비밀번호 안 바꿈"). OAuth는 아직
 * 공급자를 열지 않았으므로 여기서 막는다 — 조용히 무시하면 등록은 됐는데 인증이 안 되는
 * 계정이 남는다.
 */
function secretOf(credential: MailCredential | null): string | undefined {
  if (!credential || credential.kind === 'mock') return undefined;
  if (credential.kind === 'app_password') return credential.value;
  throw new MailError('PROVIDER_UNAVAILABLE', '이 인증 방식은 아직 지원하지 않습니다.');
}

/** Function이 아직 구현하지 않은 동작. 조용히 빈 값을 주면 "메일이 없다"로 오해된다. */
function notYet(what: string): never {
  throw new MailError(
    'PROVIDER_UNAVAILABLE',
    `${what}은(는) 아직 준비 중입니다. 메일 서버 이식이 끝나면 열립니다.`,
  );
}

export const appwriteMailGateway: MailGateway = {
  async testConnection(_ctx, draft, credential): Promise<MailConnectionResult> {
    return call<MailConnectionResult>('testConnection', {
      draft,
      secret: secretOf(credential),
    });
  },

  async createAccount(_ctx, draft, credential): Promise<MailAccount> {
    return call<MailAccount>('createAccount', { draft, secret: secretOf(credential) });
  },

  async listAccounts(): Promise<MailAccount[]> {
    return call<MailAccount[]>('listAccounts');
  },

  async updateAccount(_ctx, id, draft: MailAccountDraft, credential): Promise<MailAccount> {
    return call<MailAccount>('updateAccount', { id, draft, secret: secretOf(credential) });
  },

  async deleteAccount(_ctx, id): Promise<void> {
    await call<{ id: string }>('deleteAccount', { id });
  },

  // ── 아래는 Function 이식이 남은 구간 (MailHub `mail.service.ts` 기준 IMAP·SMTP 동작) ──

  async listFolders(): Promise<Record<string, MailFolder[]>> { return notYet('폴더 조회'); },
  async countUnseen(): Promise<Record<string, number>> { return notYet('안 읽은 메일 수'); },
  async listMails(): Promise<InboxPage[]> { return notYet('메일 목록'); },
  async getMail(): Promise<MailDetail> { return notYet('메일 열기'); },
  async markRead(): Promise<void> { return notYet('읽음 표시'); },
  async markFlagged(): Promise<void> { return notYet('별표 표시'); },
  async sendMail(): Promise<MailSendResult> { return notYet('메일 보내기'); },
  async moveMail(_ctx, _ref: MailRef, _to: MailFolder): Promise<void> { return notYet('메일 이동'); },
  async downloadAttachment(): Promise<MailAttachmentContent> { return notYet('첨부 내려받기'); },
};
