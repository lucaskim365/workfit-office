import type { MailAccount, MailAccountDraft } from '@/domain/mailAccount/schema';
import type { InboxPage, MailErrorCode } from '@/domain/mail/engine';
import type { MailDetail, MailFolder, MailRef, SendMailInput } from '@/domain/mail/schema';

/**
 * 메일 gateway 계약.
 *
 * 설계 §6의 서버 함수와 1:1로 맞춘다. 화면과 훅은 이 인터페이스만 알고, 뒤에 붙는 것이
 * 로컬 목업인지 Firebase Functions인지 구분하지 않는다. 공급자별 토큰·폴더명·API 응답은
 * 이 경계를 넘어오지 않는다. ([[jwheo/feat/mail/DESIGN.md]] §6 · §10.1)
 */
export interface MailGateway {
  testConnection(ctx: MailGatewayContext, draft: MailAccountDraft, credential: MailCredential): Promise<MailConnectionResult>;
  createAccount(ctx: MailGatewayContext, draft: MailAccountDraft, credential: MailCredential): Promise<MailAccount>;
  listAccounts(ctx: MailGatewayContext): Promise<MailAccount[]>;
  updateAccount(ctx: MailGatewayContext, id: string, draft: MailAccountDraft, credential: MailCredential | null): Promise<MailAccount>;
  deleteAccount(ctx: MailGatewayContext, id: string): Promise<void>;

  /**
   * 계정별로 실제 쓸 수 있는 논리 폴더.
   *
   * 공급자·계정마다 다르다. 없는 폴더를 화면에 열어 두면 눌렀을 때 빈 목록이 나오고
   * 사용자는 메일이 없는 것인지 폴더가 없는 것인지 구분할 수 없다.
   */
  listFolders(ctx: MailGatewayContext): Promise<Record<string, MailFolder[]>>;
  /** 계정별 받은메일함 안 읽은 수. 실패한 계정은 응답에서 빠진다 — 0으로 속이지 않는다. */
  countUnseen(ctx: MailGatewayContext): Promise<Record<string, number>>;
  listMails(ctx: MailGatewayContext, accountIds: string[], folder: MailFolder, perAccount: number, query?: MailQuery): Promise<InboxPage[]>;
  getMail(ctx: MailGatewayContext, ref: MailRef): Promise<MailDetail>;
  /**
   * 읽음·안 읽음 표시. 복수 식별자를 받아 일괄 처리한다. ([[DESIGN.md]] §6 `markMailRead`)
   *
   * `seen: false`는 안 읽음 되돌리기다 — 열어본 메일을 나중에 다시 볼 표시로 쓰는 것은
   * 메일 클라이언트의 기본 동작에 가깝다.
   */
  markRead(ctx: MailGatewayContext, refs: MailRef[], seen: boolean): Promise<void>;
  /** 별표(중요) 표시. IMAP `\Flagged`라 다른 클라이언트에서 단 별표도 함께 보인다. */
  markFlagged(ctx: MailGatewayContext, refs: MailRef[], flagged: boolean): Promise<void>;
  sendMail(ctx: MailGatewayContext, input: SendMailInput): Promise<MailSendResult>;
  /** 폴더 간 이동. 휴지통 이동이 여기에 해당한다. 영구 삭제는 열지 않는다. */
  moveMail(ctx: MailGatewayContext, ref: MailRef, to: MailFolder): Promise<void>;
  /** 첨부 하나 내려받기. 상세에는 메타데이터만 실리고 내용은 누를 때 받는다. */
  downloadAttachment(ctx: MailGatewayContext, ref: MailRef, index: number): Promise<MailAttachmentContent>;
}

export interface MailAttachmentContent {
  filename: string;
  contentType: string;
  size: number;
  /** base64. 화면이 blob으로 바꿔 저장한다. */
  base64: string;
}

/**
 * 호출자 정보.
 *
 * 로컬 목업에서만 의미가 있다. 실제 gateway는 이 값을 **무시하고** Firebase Auth 토큰의
 * UID로 소유권을 판정한다. 클라이언트가 보낸 사용자 ID를 신뢰하지 않는다. ([[DESIGN.md]] §4-1)
 */
export interface MailGatewayContext {
  workfitUserId: string;
}

/**
 * 자격 증명 전달 형식.
 *
 * 요청에는 실릴 수 있지만 응답·로그·클라이언트 상태에는 남지 않는다. 1차 로컬 범위에서는
 * `mock`만 허용하고 나머지는 gateway가 거절한다 — 실수로 실제 앱 비밀번호가 브라우저
 * 메모리에 들어오는 경로 자체를 없애기 위해서다. ([[DESIGN.md]] §4-3 · §4-6)
 */
export type MailCredential =
  | { kind: 'mock' }
  | { kind: 'app_password'; value: string }
  | { kind: 'oauth_code'; value: string; verifier: string };

/**
 * 조회 조건.
 *
 * 서버에서 IMAP `SEARCH`로 처리한다. 받아온 목록을 클라이언트에서 거르면 계정당 조회
 * 상한 밖의 메일은 아예 걸리지 않아 "검색해도 안 나온다"가 된다.
 * ([[jwheo/feat/mail/DESIGN.md]] §6)
 */
export interface MailQuery {
  /** 제목·보낸사람·받는사람·참조·본문을 함께 찾는다. */
  text?: string;
  unseenOnly?: boolean;
  /** 별표(중요)만. */
  flaggedOnly?: boolean;
}

export interface MailConnectionResult {
  smtp: { ok: boolean; code: MailErrorCode | null };
  imap: { ok: boolean; code: MailErrorCode | null };
}

export const isConnectionOk = (result: MailConnectionResult): boolean =>
  result.smtp.ok && result.imap.ok;

export interface MailSendResult {
  /** 보낸 편지함에 저장된 위치. 공급자가 알려주지 않으면 null이고 화면은 성공만 표시한다. */
  savedTo: MailRef | null;
  sentAt: string;
}
