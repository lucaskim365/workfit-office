import { z } from 'zod';

/**
 * 메일 주소 검사는 느슨하게 둔다. RFC 5322를 엄격히 흉내 내면 실제로 쓰이는 주소를 막는 쪽이
 * 더 잦고, 최종 판정은 어차피 발송을 받아 주는 서버가 한다.
 */
export const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;.]+(\.[^\s@,;.]+)+$/;

/**
 * 논리 폴더.
 *
 * 공급자마다 실제 IMAP 폴더 이름이 다르고(네이버 `보낸메일함`, Gmail `[Gmail]/보낸편지함`)
 * 언어 설정으로도 바뀐다. 도메인은 네 가지 논리 이름만 알고 실제 매핑은 공급자 어댑터가
 * 맡는다. ([[jwheo/feat/mail/DESIGN.md]] §3.1)
 */
export const MAIL_FOLDERS = ['INBOX', 'SENT', 'DRAFTS', 'TRASH'] as const;
export type MailFolder = (typeof MAIL_FOLDERS)[number];

export const MAIL_FOLDER_LABELS: Record<MailFolder, string> = {
  INBOX: '받은메일함',
  SENT: '보낸메일함',
  DRAFTS: '임시보관',
  TRASH: '휴지통',
};

export const MAIL_FOLDER_ICONS: Record<MailFolder, string> = {
  INBOX: '📥',
  SENT: '📤',
  DRAFTS: '📝',
  TRASH: '🗑️',
};

/**
 * 메일 복합 식별자.
 *
 * 메일은 계정 밖에서 전역 고유 ID를 갖지 않는다. IMAP UID는 `uidValidity` 세대 안에서만
 * 유효하고, 메일함이 재생성되면 세대가 바뀌면서 **UID가 재사용된다.** `uidValidity` 없이
 * UID만 들고 있으면 드물게 엉뚱한 메일을 가리킨다. 네 값을 항상 함께 다룬다.
 * ([[jwheo/feat/mail/DESIGN.md]] §6, MailHub `mail.service.ts`의 메시지 ID와 같은 구성)
 */
export const mailRefSchema = z.object({
  accountId: z.string().min(1),
  folder: z.enum(MAIL_FOLDERS),
  uidValidity: z.string().min(1),
  uid: z.string().min(1),
});

export type MailRef = z.infer<typeof mailRefSchema>;

export const mailAddressSchema = z.object({
  /** 표시 이름. 없으면 빈 문자열이고 화면은 주소를 대신 보여준다. */
  name: z.string().trim().max(100),
  email: z.string().trim().regex(EMAIL_PATTERN, '메일 주소 형식이 아닙니다.'),
});

export type MailAddress = z.infer<typeof mailAddressSchema>;

/** 목록 한 줄. 본문은 담지 않는다. */
export const mailSummarySchema = z.object({
  ref: mailRefSchema,
  from: mailAddressSchema,
  to: z.array(mailAddressSchema),
  subject: z.string().max(500),
  /** 본문 앞부분 미리보기. 서버가 텍스트로 변환한 결과만 내려온다. */
  preview: z.string().max(300),
  receivedAt: z.string().datetime(),
  seen: z.boolean(),
  /** 답장을 보낸 메일. 발송이 끝나면 서버가 원본에 `\Answered` 플래그를 단다. (§6) */
  answered: z.boolean(),
  /** 별표(중요) 표시. IMAP `\Flagged`로 서버에 저장되어 다른 메일 클라이언트와 공유된다. */
  flagged: z.boolean(),
  hasAttachment: z.boolean(),
});

export type MailSummary = z.infer<typeof mailSummarySchema>;

/**
 * 첨부 메타데이터.
 *
 * 내용은 담지 않는다. 상세를 열 때마다 첨부 전체를 실어 보내면 응답이 수십 MB가 되고
 * 대부분은 내려받지도 않는다. 실제 내용은 누를 때 따로 받는다.
 */
export const mailAttachmentSchema = z.object({
  /** 메일 안에서의 순번. 원문을 다시 파싱해도 같은 순서가 나온다. */
  index: z.number().int().min(0),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().min(0),
});

export type MailAttachment = z.infer<typeof mailAttachmentSchema>;

/**
 * 상세.
 *
 * HTML **원문**과 외부 이미지는 추적·스크립트 위험 때문에 클라이언트로 내리지 않는다.
 * 서버가 정화한 결과만 `htmlBody`로 주고, 없으면 텍스트 대체본 `textBody`를 표시한다.
 * ([[DESIGN.md]] §8 본문 안전성)
 */
export const mailDetailSchema = mailSummarySchema.extend({
  cc: z.array(mailAddressSchema),
  replyTo: mailAddressSchema.nullable(),
  textBody: z.string(),
  /** 서버가 정화한 HTML 본문. 원문이 텍스트뿐이거나 서버가 정화를 지원하지 않으면 null. */
  htmlBody: z.string().nullable(),
  /** 답장 스레드 헤더. 원문에 없으면 null이고 답장은 헤더 없이 나간다. */
  messageId: z.string().nullable(),
  references: z.array(z.string()),
  /** 원문에 HTML만 있어 텍스트로 변환했는지. 화면이 안내 문구를 띄운다. */
  convertedFromHtml: z.boolean(),
  /** 본문에 박힌 인라인 이미지는 빠진다. 서명 로고가 첨부로 잡히면 목록이 쓸모없어진다. */
  attachments: z.array(mailAttachmentSchema),
});

export type MailDetail = z.infer<typeof mailDetailSchema>;

export const MAIL_SUBJECT_MAX = 500;
export const MAIL_BODY_MAX = 50_000;

/**
 * 보낼 때 올리는 첨부. 내용을 base64로 실어 보내고 SMTP 멀티파트 구성은 서버(nodemailer)가
 * 한다. 받은 첨부(`mailAttachmentSchema`)와 달리 내용이 함께 실린다 — 서버가 원문을 갖고
 * 있지 않은 새 파일이라 실어 보내는 것 말고는 전달할 방법이 없다.
 */
export const outgoingAttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  /** 원본 바이트 수. base64는 약 4/3로 부풀므로 상한 검사는 이 값으로 한다. */
  size: z.number().int().min(0),
  base64: z.string().min(1),
});

export type OutgoingAttachment = z.infer<typeof outgoingAttachmentSchema>;

/** 보낼 첨부 총량 상한. 브리지의 내려받기·전달 상한과 같은 값을 쓴다. ([[DESIGN.md]] §15) */
export const MAIL_OUTGOING_TOTAL_MAX = 20 * 1024 * 1024;

export const MAIL_COMPOSE_MODES = ['new', 'reply', 'replyAll', 'forward'] as const;
export type MailComposeMode = (typeof MAIL_COMPOSE_MODES)[number];

/**
 * 답장·전달의 원본.
 *
 * 답장은 스레드 헤더와 원본 `\Answered` 플래그에 쓰고, 전달은 헤더만 쓴다. 전달에 원본을
 * 답장 처리하면 보내지도 않은 사람에게 답한 것으로 표시된다.
 */
export const mailOriginSchema = z.object({
  ref: mailRefSchema,
  mode: z.enum(['reply', 'replyAll', 'forward']),
});

export type MailOrigin = z.infer<typeof mailOriginSchema>;

/** 발송 요청. 발신 계정은 ID로만 지정하고 실제 주소는 서버가 계정에서 읽는다. */
export const sendMailInputSchema = z.object({
  accountId: z.string().min(1),
  to: z.array(mailAddressSchema).min(1, '받는 사람을 입력하세요.'),
  cc: z.array(mailAddressSchema),
  /** 숨은참조. 받는 사람·참조 어디에도 노출되지 않아야 한다. */
  bcc: z.array(mailAddressSchema),
  subject: z.string().trim().max(MAIL_SUBJECT_MAX),
  textBody: z.string().max(MAIL_BODY_MAX),
  origin: mailOriginSchema.nullable(),
  /** 작성 화면에서 올린 첨부. 전달 시 원본 첨부는 서버가 따로 싣는다. */
  attachments: z.array(outgoingAttachmentSchema),
});

export type SendMailInput = z.infer<typeof sendMailInputSchema>;

/**
 * 임시보관.
 *
 * 공급자에 올리지 않고 로컬에만 둔다. IMAP `APPEND`로 올리면 작성 중 저장이 매번 서버
 * 왕복을 일으킨다. ([[DESIGN.md]] §3.1)
 *
 * 받는 사람이 비어 있어도 저장된다. 쓰다 만 메일을 남기는 것이 목적이라 발송 검증을
 * 적용하면 저장 자체가 막힌다.
 */
export const mailDraftSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  to: z.array(mailAddressSchema),
  cc: z.array(mailAddressSchema),
  bcc: z.array(mailAddressSchema),
  subject: z.string().max(MAIL_SUBJECT_MAX),
  textBody: z.string().max(MAIL_BODY_MAX),
  origin: mailOriginSchema.nullable(),
  updatedAt: z.string().datetime(),
});

export type MailDraft = z.infer<typeof mailDraftSchema>;

/** 계정당·통합 조회 상한. 서버 이관 시에도 같은 값을 쓴다. ([[DESIGN.md]] §14-④) */
export const MAIL_FETCH_PER_ACCOUNT = 50;
export const MAIL_FETCH_TOTAL = 200;
/** `더 보기`로 늘릴 수 있는 계정당 최대치. 통합 상한(200)은 그대로라 2계정×100이 꼭 찬다. */
export const MAIL_FETCH_PER_ACCOUNT_MAX = 100;

/**
 * 최근 받는 사람. 발송이 성공할 때 로컬에 기록해 두었다가 작성 시 추천한다.
 * 서버·계정과 무관한 순수 편의 데이터라 브라우저에만 산다.
 */
export const recentRecipientSchema = z.object({
  name: z.string().max(100),
  email: z.string().regex(EMAIL_PATTERN),
  lastUsedAt: z.string().datetime(),
});

export type RecentRecipient = z.infer<typeof recentRecipientSchema>;
