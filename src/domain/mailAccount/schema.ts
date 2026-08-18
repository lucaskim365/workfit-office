import { z } from 'zod';
import { EMAIL_PATTERN } from '@/domain/mail/schema';

export const MAIL_PROVIDERS = ['naver', 'daum', 'google', 'microsoft', 'custom'] as const;
export const MAIL_AUTH_TYPES = ['app_password', 'oauth2'] as const;
export const MAIL_TRANSPORTS = ['imap_smtp', 'gmail_api', 'microsoft_graph'] as const;
export const MAIL_ACCOUNT_STATUSES = ['active', 'error', 'disabled'] as const;

export type MailProvider = (typeof MAIL_PROVIDERS)[number];
export type MailAuthType = (typeof MAIL_AUTH_TYPES)[number];
export type MailTransport = (typeof MAIL_TRANSPORTS)[number];
export type MailAccountStatus = (typeof MAIL_ACCOUNT_STATUSES)[number];

export const MAIL_PROVIDER_LABELS: Record<MailProvider, string> = {
  naver: '네이버',
  daum: '다음·카카오메일',
  google: 'Gmail',
  microsoft: 'Microsoft 365 · Outlook',
  custom: '직접 설정',
};

export const MAIL_ACCOUNT_STATUS_LABELS: Record<MailAccountStatus, string> = {
  active: '연결됨',
  error: '오류',
  disabled: '중지',
};

/**
 * 클라이언트가 보는 메일 계정.
 *
 * 서버 모델에는 `encryptedCredential`과 인증 아이디 전체값이 있지만 이 스키마에는 **필드 자체가
 * 없다.** 목록 API가 값을 지우는 것이 아니라 클라이언트 도메인이 담을 자리를 두지 않는 쪽이,
 * 나중에 서버 DTO가 바뀌어도 비밀값이 화면 상태로 새지 않는다. ([[jwheo/feat/mail/DESIGN.md]] §4 · §5)
 */
export const mailAccountSchema = z.object({
  id: z.string().min(1),
  /** Workfit 사용자 ID. 실제 연동에서는 서버가 인증 토큰의 UID로 소유권을 다시 확인한다. */
  workfitUserId: z.string().min(1),
  displayName: z.string().trim().min(1, '표시 이름을 입력하세요.').max(50),
  /** 소문자로 정규화된 주소. `workfitUserId + email`은 중복 등록할 수 없다. */
  email: z.string().trim().regex(EMAIL_PATTERN, '메일 주소 형식이 아닙니다.'),
  provider: z.enum(MAIL_PROVIDERS),
  authType: z.enum(MAIL_AUTH_TYPES),
  transport: z.enum(MAIL_TRANSPORTS),
  status: z.enum(MAIL_ACCOUNT_STATUSES),
  /** 마지막으로 연결 테스트에 성공한 시각. */
  verifiedAt: z.string().datetime().nullable(),
  /** 계정별 텍스트 서명. 작성 화면이 본문 아래에 붙인다. 비어 있으면 붙이지 않는다. */
  signature: z.string().max(1000),
  /** 실패 원인은 정규화된 코드로만 남긴다. 서버 내부 메시지는 내려보내지 않는다. */
  lastErrorCode: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MailAccount = z.infer<typeof mailAccountSchema>;

/** 계정 등록·수정 입력. 자격 증명은 여기에도 담기지 않는다. */
export const mailAccountDraftSchema = mailAccountSchema.pick({
  displayName: true,
  email: true,
  provider: true,
  signature: true,
});

export type MailAccountDraft = z.infer<typeof mailAccountDraftSchema>;

export interface MailProviderPreset {
  provider: MailProvider;
  label: string;
  authType: MailAuthType;
  transport: MailTransport;
  /** 사용자가 준비해야 할 것. 호스트·포트는 서버 코드에만 두고 클라이언트로 내리지 않는다. */
  guide: string;
  helpUrl: string;
  /** 1차 로컬 범위에서 연결 UI를 여는지. 나머지는 서버 승인 뒤에 연다. */
  available: boolean;
  unavailableReason: string | null;
}

/**
 * 공급자 프리셋.
 *
 * Gmail과 Microsoft는 앱 비밀번호 프리셋으로 취급하지 않는다. 두 곳 모두 OAuth 2.0과
 * 각자의 API를 권장하고 기본 인증을 막고 있어 어댑터가 따로 필요하다. ([[DESIGN.md]] §10.1)
 */
export const MAIL_PROVIDER_PRESETS: MailProviderPreset[] = [
  {
    provider: 'naver',
    label: MAIL_PROVIDER_LABELS.naver,
    authType: 'app_password',
    transport: 'imap_smtp',
    guide: '네이버 메일 환경설정에서 IMAP/SMTP를 사용함으로 바꾸고 2단계 인증 사용 시 애플리케이션 비밀번호를 발급받으세요.',
    helpUrl: 'https://help.naver.com/service/5626/category/5122',
    available: true,
    unavailableReason: null,
  },
  {
    provider: 'daum',
    label: MAIL_PROVIDER_LABELS.daum,
    authType: 'app_password',
    transport: 'imap_smtp',
    guide: '카카오메일 설정에서 IMAP/SMTP 사용을 켜고 외부 메일 프로그램용 비밀번호를 발급받으세요.',
    helpUrl: 'https://cs.kakao.com/helps?service=52',
    available: true,
    unavailableReason: null,
  },
  {
    provider: 'google',
    label: MAIL_PROVIDER_LABELS.google,
    authType: 'oauth2',
    transport: 'gmail_api',
    guide: 'Google 계정 동의 화면에서 메일 권한을 승인해 연결합니다.',
    helpUrl: 'https://developers.google.com/workspace/gmail/imap/imap-smtp',
    available: false,
    unavailableReason: 'OAuth 앱 등록과 메일 권한 검증이 필요해 승인 후 엽니다.',
  },
  {
    provider: 'microsoft',
    label: MAIL_PROVIDER_LABELS.microsoft,
    authType: 'oauth2',
    transport: 'microsoft_graph',
    guide: 'Microsoft 계정 동의 화면에서 메일 권한을 승인해 연결합니다.',
    helpUrl: 'https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth',
    available: false,
    unavailableReason: 'Microsoft Entra 앱 등록이 필요해 승인 후 엽니다.',
  },
  {
    provider: 'custom',
    label: MAIL_PROVIDER_LABELS.custom,
    authType: 'app_password',
    transport: 'imap_smtp',
    guide: '회사 메일 서버의 SMTP·IMAP 주소와 포트를 직접 입력합니다.',
    helpUrl: '',
    available: false,
    unavailableReason: '사설·루프백 주소 차단(SSRF 방어)을 서버에서 검증한 뒤 엽니다.',
  },
];

export function mailProviderPreset(provider: MailProvider): MailProviderPreset {
  const found = MAIL_PROVIDER_PRESETS.find((row) => row.provider === provider);
  if (!found) throw new Error(`알 수 없는 메일 공급자: ${provider}`);
  return found;
}

/** 연결 UI를 열어 둔 공급자만. 나머지는 안내 문구와 함께 비활성으로 보여준다. */
export const availableMailProviders = (): MailProviderPreset[] =>
  MAIL_PROVIDER_PRESETS.filter((row) => row.available);
