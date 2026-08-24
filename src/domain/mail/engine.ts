import { EMAIL_PATTERN, MAIL_FOLDERS, type MailAddress, type MailDetail, type MailFolder, type MailRef, type MailSummary, type RecentRecipient } from './schema';

/**
 * 정규화된 오류 코드.
 *
 * 서버 내부 메시지를 그대로 내려보내면 호스트·계정 존재 여부가 새고 화면도 분기할 수 없다.
 * 사용자가 취할 행동과 연결되는 범위로만 좁힌다. ([[jwheo/feat/mail/DESIGN.md]] §6)
 */
export const MAIL_ERROR_CODES = [
  'AUTH_FAILED',
  'TIMEOUT',
  'TLS_FAILED',
  'HOST_BLOCKED',
  'PROVIDER_UNAVAILABLE',
  'NOT_FOUND',
  'FORBIDDEN',
  'INVALID_INPUT',
  'SEND_FAILED',
] as const;

export type MailErrorCode = (typeof MAIL_ERROR_CODES)[number];

export class MailError extends Error {
  constructor(public readonly code: MailErrorCode, message: string) {
    super(message);
    this.name = 'MailError';
  }
}

/** 코드별 사용자 행동 안내. 화면은 이 문구를 쓰고 원문 오류는 보여주지 않는다. */
export const MAIL_ERROR_GUIDE: Record<MailErrorCode, string> = {
  AUTH_FAILED: '인증에 실패했습니다. 앱 비밀번호를 다시 발급받아 계정을 수정하세요.',
  TIMEOUT: '메일 서버 응답이 없습니다. 잠시 후 다시 시도하세요.',
  TLS_FAILED: '보안 연결에 실패했습니다. 공급자 설정을 확인하세요.',
  HOST_BLOCKED: '허용되지 않은 서버 주소입니다.',
  PROVIDER_UNAVAILABLE: '메일 공급자가 일시적으로 응답하지 않습니다.',
  NOT_FOUND: '메일을 찾을 수 없습니다. 다른 기기에서 지웠을 수 있습니다.',
  FORBIDDEN: '이 계정에 접근할 권한이 없습니다.',
  INVALID_INPUT: '입력값을 확인하세요.',
  SEND_FAILED: '메일을 보내지 못했습니다. 잠시 후 다시 시도하세요.',
};

/**
 * 화면에 보일 오류 문구.
 *
 * 입력 오류는 어느 칸이 잘못됐는지 알려주는 원래 메시지가 안내 문구보다 쓸모 있다.
 * 연결·전송 오류는 반대로 정규화된 안내를 쓴다 — 서버 내부 메시지를 그대로 보이면
 * 호스트나 계정 존재 여부가 샌다. ([[jwheo/feat/mail/DESIGN.md]] §6)
 */
export function mailErrorText(error: unknown, fallback = '요청을 처리하지 못했습니다.'): string {
  if (!(error instanceof MailError)) return fallback;
  return error.code === 'INVALID_INPUT' ? error.message : MAIL_ERROR_GUIDE[error.code];
}

/* ------------------------------------------------------------------ 주소 */

export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const isMailAddress = (value: string): boolean => EMAIL_PATTERN.test(value.trim());

/** 화면 표기 — 표시 이름이 없으면 주소만. */
export const formatAddress = (address: MailAddress): string =>
  address.name ? `${address.name} <${address.email}>` : address.email;

export const formatAddressList = (addresses: MailAddress[]): string =>
  addresses.map(formatAddress).join(', ');

/**
 * 입력창의 주소 목록 파싱. `홍길동 <a@b.com>, c@d.com` 형태를 받는다.
 *
 * 잘못된 항목을 조용히 버리지 않고 `invalid`로 함께 돌려준다. 조용히 버리면 사용자는
 * 보냈다고 믿는데 받는 사람이 빠진다.
 */
export function parseAddressList(input: string): { addresses: MailAddress[]; invalid: string[] } {
  const addresses: MailAddress[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const raw of input.split(/[,;\n]/)) {
    const token = raw.trim();
    if (token === '') continue;

    const match = token.match(/^(.*)<([^<>]+)>$/);
    const name = match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
    const email = normalizeEmail(match ? match[2] : token);

    if (!isMailAddress(email)) {
      invalid.push(token);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    addresses.push({ name, email });
  }

  return { addresses, invalid };
}

/* ------------------------------------------------------------------ 식별자 */

/** 복합 식별자의 문자열 키. react key와 URL 쿼리에 쓴다. */
export const mailRefKey = (ref: MailRef): string =>
  `${ref.accountId}:${ref.folder}:${ref.uidValidity}:${ref.uid}`;

export const sameMailRef = (a: MailRef, b: MailRef): boolean => mailRefKey(a) === mailRefKey(b);

/** URL 쿼리에서 복원. 형식이 어긋나면 null이고 화면은 목록으로 되돌린다. */
export function parseMailRefKey(value: string): MailRef | null {
  const parts = value.split(':');
  if (parts.length !== 4) return null;
  const [accountId, folder, uidValidity, uid] = parts;
  if (!accountId || !MAIL_FOLDERS.includes(folder as MailFolder) || !uidValidity || !uid) return null;
  return { accountId, folder: folder as MailFolder, uidValidity, uid };
}

/* ------------------------------------------------------------------ 답장 */

/** `Re:`를 겹쳐 붙이지 않는다. 대소문자와 앞뒤 공백만 무시한다. */
export function replySubject(subject: string): string {
  const trimmed = subject.trim();
  if (/^re\s*:/i.test(trimmed)) return trimmed;
  return `Re: ${trimmed}`;
}

export type ReplyMode = 'reply' | 'replyAll';

/**
 * 답장 수신자 계산.
 *
 * 전체답장은 원본의 받는 사람과 참조를 참조로 옮기되 **내가 연결한 모든 주소**를 뺀다.
 * 연결 계정이 여럿이면 다른 계정 주소로도 나에게 되돌아오기 때문에 발신 계정 하나만
 * 제외해서는 부족하다. 받는 사람과 중복되는 주소도 뺀다. ([[DESIGN.md]] §8 작성 화면)
 */
export function replyRecipients(
  detail: MailDetail,
  selfEmails: string[],
  mode: ReplyMode,
): { to: MailAddress[]; cc: MailAddress[] } {
  const self = new Set(selfEmails.map(normalizeEmail));

  // 받는 사람에서도 내 주소를 뺀다. 내가 보낸 메일을 다시 열어 답장하면 나에게만 보내는
  // 메일이 만들어지기 때문이다. 결과가 비면 화면이 받는 사람을 비운 채로 열고 사용자가 채운다.
  const primary = detail.replyTo ?? detail.from;
  const to = self.has(normalizeEmail(primary.email)) ? [] : [primary];
  if (mode === 'reply') return { to, cc: [] };

  const excluded = new Set([...self, ...to.map((address) => normalizeEmail(address.email))]);

  const cc: MailAddress[] = [];
  for (const address of [...detail.to, ...detail.cc]) {
    const email = normalizeEmail(address.email);
    if (excluded.has(email)) continue;
    excluded.add(email);
    cc.push(address);
  }
  return { to, cc };
}

/**
 * 답장 스레드 헤더. 원본의 `References`에 원본 `Message-ID`를 더한다.
 *
 * 메일 클라이언트가 대화를 묶는 근거라 빠지면 답장이 새 스레드로 뜬다. 원본에 헤더가
 * 없으면 빈 배열이고 서버는 헤더 없이 보낸다. (MailHub `mail.service.ts` `normalizeReferences`)
 */
export function threadReferences(detail: MailDetail): string[] {
  const values = [...detail.references];
  if (detail.messageId && !values.includes(detail.messageId)) values.push(detail.messageId);
  return values;
}

/** 원문 인용. 답장 본문 맨 아래에 붙인다. */
export function quoteReplyBody(detail: MailDetail): string {
  const quoted = detail.textBody
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');
  return `\n\n----- 원본 메일 -----\n보낸사람: ${formatAddress(detail.from)}\n제목: ${detail.subject}\n\n${quoted}\n`;
}

/* ------------------------------------------------------------------ 전달 */

/** `Fwd:`를 겹쳐 붙이지 않는다. 이미 붙은 `Re:`는 그대로 둔다. */
export function forwardSubject(subject: string): string {
  const trimmed = subject.trim();
  if (/^(fwd?|전달)\s*:/i.test(trimmed)) return trimmed;
  return `Fwd: ${trimmed}`;
}

/**
 * 전달 본문.
 *
 * 답장과 달리 인용 접두를 붙이지 않고 원본 헤더를 그대로 보인다. 전달은 원문을 옮기는
 * 것이라 받는 사람이 원래 수신자와 시각을 알아야 한다.
 */
export function forwardBody(detail: MailDetail): string {
  const header = [
    `보낸사람: ${formatAddress(detail.from)}`,
    `받는사람: ${formatAddressList(detail.to)}`,
    detail.cc.length > 0 ? `참조: ${formatAddressList(detail.cc)}` : null,
    `제목: ${detail.subject}`,
  ].filter((line): line is string => line !== null).join('\n');
  return `\n\n---------- 전달된 메일 ----------\n${header}\n\n${detail.textBody}\n`;
}

/* ------------------------------------------------------------------ 작성 초기값 */

export interface ComposeDraft {
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  subject: string;
  textBody: string;
}

/** 서명 블록. 관례대로 `--` 구분선을 쓴다. 서명이 비어 있으면 아무것도 붙이지 않는다. */
export const signatureBlock = (signature: string): string =>
  signature.trim() ? `\n\n--\n${signature.trim()}\n` : '';

/**
 * 작성 화면 초기값.
 *
 * 답장·전달의 차이를 화면이 아니라 여기서 결정한다. 화면에 두면 모드가 늘 때마다 조건문이
 * 흩어지고 렌더 없이는 확인할 수 없다.
 */
export function composeDraft(
  mode: 'new' | ReplyMode | 'forward',
  signature: string,
  origin?: { detail: MailDetail; selfEmails: string[] },
): ComposeDraft {
  const sign = signatureBlock(signature);
  if (mode === 'new' || !origin) {
    return { to: [], cc: [], bcc: [], subject: '', textBody: sign };
  }

  if (mode === 'forward') {
    return {
      to: [],
      cc: [],
      bcc: [],
      subject: forwardSubject(origin.detail.subject),
      textBody: `${sign}${forwardBody(origin.detail)}`,
    };
  }

  const { to, cc } = replyRecipients(origin.detail, origin.selfEmails, mode);
  return {
    to,
    cc,
    bcc: [],
    subject: replySubject(origin.detail.subject),
    textBody: `${sign}${quoteReplyBody(origin.detail)}`,
  };
}

/* ------------------------------------------------------------------ 통합 목록 */

export interface MailAccountFailure {
  accountId: string;
  code: MailErrorCode;
}

export interface InboxPage {
  accountId: string;
  mails: MailSummary[] | null;
  error: MailErrorCode | null;
}

/**
 * 계정별 조회 결과를 통합 목록으로 합친다.
 *
 * 한 계정이 실패해도 나머지 메일은 그대로 보여주고 실패한 계정만 따로 알린다. 하나가
 * 죽었다고 받은메일 전체를 비우면 사용자는 원인도 모른 채 아무것도 못 본다. ([[DESIGN.md]] §6)
 */
export function mergeInboxPages(pages: InboxPage[], limit: number): {
  mails: MailSummary[];
  failures: MailAccountFailure[];
} {
  const mails: MailSummary[] = [];
  const failures: MailAccountFailure[] = [];

  for (const page of pages) {
    if (page.error !== null) {
      failures.push({ accountId: page.accountId, code: page.error });
      continue;
    }
    if (page.mails) mails.push(...page.mails);
  }

  mails.sort((a, b) => {
    const byTime = b.receivedAt.localeCompare(a.receivedAt);
    // 같은 시각이면 계정·UID로 순서를 고정한다. 렌더마다 순서가 흔들리면 선택이 튄다.
    return byTime !== 0 ? byTime : mailRefKey(a.ref).localeCompare(mailRefKey(b.ref));
  });

  return { mails: mails.slice(0, limit), failures };
}

/* ------------------------------------------------------------- 최근 받는 사람 추천 */

/** 주소 입력창에서 지금 편집 중인 조각(마지막 구분자 뒤). 추천은 이 조각만 본다. */
export function activeAddressSegment(value: string): { prefix: string; term: string } {
  const cut = Math.max(value.lastIndexOf(','), value.lastIndexOf(';'));
  return {
    prefix: cut >= 0 ? value.slice(0, cut + 1) : '',
    term: value.slice(cut + 1).trim(),
  };
}

/**
 * 최근 받는 사람 추천.
 *
 * 검색어가 비어 있으면 아무것도 내지 않는다 — 입력을 시작하기도 전에 목록이 덮으면
 * 방해다. 입력창에 이미 있는 주소는 뺀다(같은 사람을 두 번 넣게 된다). 최신 사용순.
 */
export function suggestRecipients(
  rows: RecentRecipient[],
  term: string,
  excludeEmails: string[],
  limit = 6,
): RecentRecipient[] {
  const keyword = term.trim().toLowerCase();
  if (keyword === '') return [];

  const taken = new Set(excludeEmails.map((email) => email.toLowerCase()));
  return rows
    .filter((row) => !taken.has(row.email))
    .filter((row) => row.email.includes(keyword) || row.name.toLowerCase().includes(keyword))
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, limit);
}

/**
 * 추천 후보 합치기 — 최근 사용한 주소가 사내 주소록보다 앞선다.
 *
 * 사내 사용자는 사용 이력이 없으므로 시각을 0으로 둬 정렬에서 뒤로 밀리고, 같은 주소가
 * 양쪽에 있으면 최근 기록을 남긴다. 주소 형식이 아닌 값(미입력 등)은 조용히 뺀다.
 */
export function mergeRecipientSources(
  recents: RecentRecipient[],
  colleagues: { name: string; email: string }[],
): RecentRecipient[] {
  const taken = new Set(recents.map((row) => row.email));
  const rest = colleagues
    .map((row) => ({ name: row.name, email: row.email.trim().toLowerCase(), lastUsedAt: new Date(0).toISOString() }))
    .filter((row) => EMAIL_PATTERN.test(row.email) && !taken.has(row.email));
  return [...recents, ...rest];
}

/** 편집 중인 조각을 고른 주소로 바꾼 새 입력값. 구분자를 붙여 다음 주소를 바로 잇게 한다. */
export function applyRecipientSuggestion(value: string, pick: RecentRecipient): string {
  const { prefix } = activeAddressSegment(value);
  const label = pick.name ? `${pick.name} <${pick.email}>` : pick.email;
  return `${prefix}${prefix ? ' ' : ''}${label}, `;
}
