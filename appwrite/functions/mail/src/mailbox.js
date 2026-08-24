/**
 * 메일함 조회 — IMAP 결과를 화면 도메인(`MailSummary`·`MailDetail`·`InboxPage`)으로 옮긴다.
 *
 * 계정 자격 증명은 여기서만 푼다. 복호화한 평문은 IMAP 인증에 넘길 때만 메모리에 있고
 * 응답에는 절대 실리지 않는다.
 */
import { Query } from 'node-appwrite';
import { simpleParser } from 'mailparser';
import sanitizeHtml from 'sanitize-html';
import { decryptSecret } from './credentials.js';
import { connectionSettings } from './providers.js';
import { classifyError } from './verify.js';
import {
  applyFlag,
  countUnseenInbox,
  fetchMessageSource,
  fetchMessages,
  listAvailableFolders,
  moveMessage,
} from './imap.js';
import { MailFnError } from './accounts.js';

const COLLECTION = 'mailAccounts';

/** 소유자의 계정들. 요청에 계정 ID가 오더라도 소유자 조건을 반드시 함께 건다. */
async function ownedAccounts(dbs, dbId, uid, accountIds) {
  const res = await dbs.listDocuments(dbId, COLLECTION, [
    Query.equal('workfitUserId', uid),
    Query.limit(50),
  ]);
  const rows = res.documents;
  if (!accountIds || accountIds.length === 0) return rows;
  return rows.filter((row) => accountIds.includes(row.id));
}

/** 계정 문서 → IMAP 접속 설정. 자격 증명을 푸는 유일한 지점이다. */
function settingsOf(account, env) {
  return connectionSettings(account, decryptSecret(account.encryptedSecret, env));
}

const addressOf = (name, email) => ({
  name: String(name || '').trim().slice(0, 100),
  email: String(email || '').trim(),
});

/** 주소가 없는 항목은 뺀다. 도메인 스키마가 메일 주소 형식을 요구한다. */
const addressList = (rows) => (rows ?? [])
  .map((row) => addressOf(row.name, row.address))
  .filter((row) => row.email !== '');

/** IMAP 요약 → `MailSummary`. */
function toSummary(accountId, folder, row) {
  return {
    ref: {
      accountId,
      folder,
      uidValidity: String(row.uidValidity),
      uid: String(row.uid),
    },
    from: addressOf(row.senderName, row.senderAddress),
    to: addressList(row.recipients),
    subject: String(row.subject || '(제목 없음)').slice(0, 500),
    // 목록에서는 본문을 받지 않는다. 미리보기를 채우려면 메일마다 본문을 내려받아야 한다.
    preview: '',
    receivedAt: (row.receivedAt instanceof Date ? row.receivedAt : new Date(row.receivedAt)).toISOString(),
    seen: Boolean(row.seen),
    answered: Boolean(row.answered),
    flagged: Boolean(row.flagged),
    hasAttachment: Boolean(row.hasAttachment),
  };
}

/**
 * CSS 값 패턴.
 *
 * 어떤 속성에도 `url(`이 들어오지 못하게 앞에서 막는다. `background`·`border-image`로
 * 외부 주소를 실으면 이미지 경로를 거치지 않고 열람 추적이 되기 때문이다.
 */
const css = (body) => new RegExp(`^(?!.*url\\()${body}$`, 'i');

const CSS_COLOR = [
  css('#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})'),
  css('rgba?\\([\\d.,%\\s]+\\)'),
  css('[a-z]+'),
];
const CSS_LENGTH = [css('-?\\d+(?:\\.\\d+)?(?:px|pt|em|rem|%|vw|vh)?'), css('auto')];
const CSS_KEYWORD = [css('[a-z-]+')];
/** 여러 값이 이어지는 단축 속성(`1px solid #ccc`). 괄호는 rgb() 때문에 남긴다. */
const CSS_SHORTHAND = [css('[0-9a-z#.,%()\\s-]+')];

/**
 * 인라인 서식 허용 목록.
 *
 * HTML 메일은 사실상 전부 `<table>` 레이아웃 + 인라인 `style`로 만들어진다. 이걸 통째로
 * 벗기면 디자인된 메일이 맨 텍스트 덩어리가 된다. 위치 지정(`position`·`z-index`)만은
 * 빼 둔다 — 화면 위에 겹쳐 띄워 다른 내용을 가리는 데 쓸 수 있다.
 */
const ALLOWED_STYLES = {
  color: CSS_COLOR,
  'background-color': CSS_COLOR,
  'font-family': [css('[a-z0-9\\s,\'"-]+')],
  'font-size': CSS_LENGTH,
  'font-weight': [...CSS_KEYWORD, css('\\d{3}')],
  'font-style': CSS_KEYWORD,
  'line-height': [...CSS_LENGTH, css('\\d+(?:\\.\\d+)?')],
  'text-align': CSS_KEYWORD,
  'text-decoration': CSS_SHORTHAND,
  'text-transform': CSS_KEYWORD,
  'vertical-align': [...CSS_KEYWORD, ...CSS_LENGTH],
  'white-space': CSS_KEYWORD,
  display: CSS_KEYWORD,
  width: CSS_LENGTH,
  height: CSS_LENGTH,
  'max-width': CSS_LENGTH,
  'min-width': CSS_LENGTH,
  margin: CSS_SHORTHAND,
  'margin-top': CSS_LENGTH,
  'margin-right': CSS_LENGTH,
  'margin-bottom': CSS_LENGTH,
  'margin-left': CSS_LENGTH,
  padding: CSS_SHORTHAND,
  'padding-top': CSS_LENGTH,
  'padding-right': CSS_LENGTH,
  'padding-bottom': CSS_LENGTH,
  'padding-left': CSS_LENGTH,
  border: CSS_SHORTHAND,
  'border-top': CSS_SHORTHAND,
  'border-right': CSS_SHORTHAND,
  'border-bottom': CSS_SHORTHAND,
  'border-left': CSS_SHORTHAND,
  'border-color': CSS_COLOR,
  'border-style': CSS_KEYWORD,
  'border-width': CSS_LENGTH,
  'border-radius': CSS_SHORTHAND,
  'border-collapse': CSS_KEYWORD,
  'border-spacing': CSS_SHORTHAND,
};

/** 표 레이아웃을 잡는 옛 HTML 속성들. 메일은 아직 이걸로 폭·정렬을 준다. */
const TABLE_LAYOUT_ATTRS = ['width', 'height', 'align', 'valign', 'bgcolor', 'colspan', 'rowspan'];

/**
 * 받은 HTML 본문 정화.
 *
 * 스크립트·이벤트 핸들러·`<style>` 블록·폼은 제거하고, 서식과 표 레이아웃은 남긴다.
 * 이미지는 통과시키되 `src` 스킴을 http(s)와 data(인라인 첨부를 바꿔 넣은 것)로 묶는다.
 * 링크는 남기되 새 창에서 열게 한다.
 *
 * ⚠ 외부 이미지가 통과하므로 발신자가 열람 시각을 알 수 있다(추적 픽셀). 일반 메일
 * 클라이언트와 같은 동작이지만, 막으려면 `img`의 허용 스킴에서 http·https를 빼면 된다.
 */
export function sanitizeMailHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: [
      'a', 'b', 'strong', 'i', 'em', 'u', 's', 'p', 'div', 'span', 'br', 'hr',
      'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'img',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'col', 'colgroup',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    ],
    allowedAttributes: {
      a: ['href', 'style'],
      img: ['src', 'alt', 'width', 'height', 'style'],
      table: [...TABLE_LAYOUT_ATTRS, 'cellpadding', 'cellspacing', 'border', 'style'],
      td: [...TABLE_LAYOUT_ATTRS, 'style'],
      th: [...TABLE_LAYOUT_ATTRS, 'style'],
      tr: ['align', 'valign', 'bgcolor', 'style'],
      col: ['width', 'span', 'style'],
      colgroup: ['width', 'span', 'style'],
      '*': ['style'],
    },
    allowedStyles: { '*': ALLOWED_STYLES },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    },
  });
}

/** 인라인 이미지를 본문에 실을 총량 상한. 넘는 첨부는 바꾸지 않고 남겨 둔다. */
const INLINE_IMAGE_BUDGET = 4 * 1024 * 1024;

/**
 * 인라인(cid) 이미지를 data URI로 바꾼다.
 *
 * 브라우저는 `cid:` 주소를 읽지 못해 로고·서명·표 이미지가 전부 깨진 아이콘으로 보인다.
 * 본문에 실으면 응답이 첨부 크기만큼 부푸므로 총량 상한을 두고, 넘으면 그 이미지는
 * 그대로 둔다 — 일부라도 보이는 편이 전부 깨지는 것보다 낫다.
 */
export function inlineCidImages(html, attachments) {
  const byCid = new Map();
  let budget = INLINE_IMAGE_BUDGET;

  for (const row of attachments ?? []) {
    const key = String(row.cid || row.contentId || '').replace(/^<|>$/g, '').trim();
    const body = row.content;
    if (key === '' || !body || !String(row.contentType || '').startsWith('image/')) continue;
    if (body.length > budget) continue;
    budget -= body.length;
    byCid.set(key, `data:${row.contentType};base64,${body.toString('base64')}`);
  }
  if (byCid.size === 0) return html;

  return html.replace(/cid:([^"'\s>)]+)/gi, (whole, cid) => byCid.get(cid.trim()) ?? whole);
}

/** 본문에 박힌 인라인 이미지는 첨부 목록에서 뺀다. 로고·서명이 첨부로 잡히면 목록이 쓸모없다. */
const isRealAttachment = (row) => row.related !== true;

const flatValues = (field) => {
  if (!field) return [];
  return Array.isArray(field) ? field.flatMap((entry) => entry.value ?? []) : (field.value ?? []);
};

/** 계정별 폴더 목록. 실패한 계정은 응답에서 빠진다 — 없는 폴더로 속이지 않는다. */
export async function listFolders(dbs, dbId, uid, accountIds, env) {
  const accounts = await ownedAccounts(dbs, dbId, uid, accountIds);
  const out = {};
  await Promise.all(accounts.map(async (account) => {
    try {
      out[account.id] = await listAvailableFolders(settingsOf(account, env));
    } catch {
      // 폴더를 못 읽은 계정은 넣지 않는다. 빈 배열을 주면 "폴더가 없는 계정"과 구분이 안 된다.
    }
  }));
  return out;
}

/** 계정별 안 읽은 수. 실패한 계정은 빠진다 — 0으로 속이면 새 메일을 놓친다. */
export async function countUnseen(dbs, dbId, uid, env) {
  const accounts = await ownedAccounts(dbs, dbId, uid, null);
  const out = {};
  await Promise.all(accounts.map(async (account) => {
    try {
      out[account.id] = await countUnseenInbox(settingsOf(account, env));
    } catch {
      /* 실패한 계정은 넣지 않는다 */
    }
  }));
  return out;
}

/**
 * 계정별 메일 목록.
 *
 * 한 계정이 실패해도 나머지는 그대로 돌려준다. 실패는 `error` 코드로 표시해 화면이 "메일이
 * 없음"과 "못 읽음"을 구분하게 한다. 계정들은 병렬로 조회한다 — 순차로 하면 계정 수만큼
 * IMAP 왕복이 쌓여 함수 타임아웃에 걸린다.
 */
export async function listMails(dbs, dbId, uid, accountIds, folder, perAccount, query, env) {
  const accounts = await ownedAccounts(dbs, dbId, uid, accountIds);
  const limit = Math.min(Math.max(Number(perAccount) || 30, 1), 200);

  return Promise.all(accounts.map(async (account) => {
    try {
      const rows = await fetchMessages(settingsOf(account, env), folder, limit, query || {});
      return { accountId: account.id, mails: rows.map((row) => toSummary(account.id, folder, row)), error: null };
    } catch (e) {
      return { accountId: account.id, mails: null, error: classifyError(e) };
    }
  }));
}

/** 메일 하나의 상세. 원문을 받아 파싱하고 HTML은 정화한 것만 내보낸다. */
export async function getMail(dbs, dbId, uid, ref, env) {
  const accounts = await ownedAccounts(dbs, dbId, uid, [ref?.accountId]);
  const account = accounts[0];
  if (!account) throw new MailFnError('NOT_FOUND', '계정을 찾을 수 없습니다.', 404);

  const folder = String(ref.folder || 'INBOX');
  const found = await fetchMessageSource(settingsOf(account, env), folder, ref.uidValidity, Number(ref.uid));
  if (!found) throw new MailFnError('NOT_FOUND', '메일을 찾을 수 없습니다. 다른 기기에서 지웠을 수 있습니다.', 404);

  const parsed = await simpleParser(found.source, { skipHtmlToText: false, skipTextToHtml: true });
  // cid를 먼저 바꾼 뒤 정화한다. 순서가 뒤집히면 아직 cid:인 src가 스킴 검사에 걸려 지워진다.
  const rawHtml = typeof parsed.html === 'string' && parsed.html.trim() !== '' ? parsed.html : null;
  const html = rawHtml === null ? null : sanitizeMailHtml(inlineCidImages(rawHtml, parsed.attachments));
  const text = parsed.text?.trim() || '본문이 없습니다.';
  const from = addressList(flatValues(parsed.from))[0] ?? addressOf('', 'unknown@unknown.invalid');
  const receivedAt = parsed.date instanceof Date ? parsed.date : new Date(0);

  return {
    ref: { accountId: account.id, folder, uidValidity: String(found.uidValidity), uid: String(ref.uid) },
    from,
    to: addressList(flatValues(parsed.to)),
    cc: addressList(flatValues(parsed.cc)),
    replyTo: addressList(flatValues(parsed.replyTo))[0] ?? null,
    subject: String(parsed.subject || '(제목 없음)').trim().slice(0, 500),
    preview: text.split('\n').find((line) => line.trim() !== '')?.slice(0, 120) ?? '',
    receivedAt: receivedAt.toISOString(),
    // 열면서 읽음 표시를 달았으므로 화면에도 읽음으로 보인다.
    seen: true,
    answered: false,
    flagged: false,
    hasAttachment: parsed.attachments.filter(isRealAttachment).length > 0,
    textBody: text,
    htmlBody: html,
    messageId: parsed.messageId ?? null,
    references: Array.isArray(parsed.references) ? parsed.references : (parsed.references ? [parsed.references] : []),
    // mailparser가 HTML을 텍스트로 바꿔 준 경우다. 화면이 서식 손실을 알리는 데 쓴다.
    convertedFromHtml: html !== null && !parsed.text,
    // 내용은 담지 않는다. 상세마다 첨부 전체를 실으면 응답이 수십 MB가 된다.
    attachments: parsed.attachments.filter(isRealAttachment).map((row, index) => ({
      index,
      filename: String(row.filename || `첨부${index + 1}`).trim(),
      contentType: row.contentType || 'application/octet-stream',
      size: row.size ?? 0,
    })),
  };
}

/**
 * 플래그 일괄 변경.
 *
 * 참조들을 계정·폴더·세대별로 묶어 한 연결에서 처리한다. 참조마다 접속하면 "모두 읽음"
 * 한 번에 IMAP 접속이 목록 길이만큼 일어난다.
 */
async function applyFlagToRefs(dbs, dbId, uid, refs, flag, on, env) {
  const list = Array.isArray(refs) ? refs : [];
  if (list.length === 0) return { updated: 0 };

  const accounts = await ownedAccounts(dbs, dbId, uid, [...new Set(list.map((r) => r.accountId))]);
  const byAccount = new Map(accounts.map((a) => [a.id, a]));

  const groups = new Map();
  for (const ref of list) {
    if (!byAccount.has(ref.accountId)) continue; // 남의 계정 참조는 조용히 버린다
    const key = `${ref.accountId} ${ref.folder} ${ref.uidValidity}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(Number(ref.uid));
  }

  let updated = 0;
  await Promise.all([...groups.entries()].map(async ([key, uids]) => {
    const [accountId, folder, uidValidity] = key.split(' ');
    const account = byAccount.get(accountId);
    try {
      const ok = await applyFlag(settingsOf(account, env), folder, uidValidity, uids, flag, on);
      if (ok) updated += uids.length;
    } catch {
      /* 일부 실패는 전체를 막지 않는다. 화면은 다음 조회에서 실제 상태를 다시 받는다. */
    }
  }));
  return { updated };
}

export const markRead = (dbs, dbId, uid, refs, seen, env) =>
  applyFlagToRefs(dbs, dbId, uid, refs, '\\Seen', seen !== false, env);

export const markFlagged = (dbs, dbId, uid, refs, flagged, env) =>
  applyFlagToRefs(dbs, dbId, uid, refs, '\\Flagged', flagged !== false, env);

/** 폴더 간 이동. 휴지통 이동이 여기에 해당한다. 영구 삭제는 열지 않는다. */
export async function moveMail(dbs, dbId, uid, ref, to, env) {
  const accounts = await ownedAccounts(dbs, dbId, uid, [ref?.accountId]);
  const account = accounts[0];
  if (!account) throw new MailFnError('NOT_FOUND', '계정을 찾을 수 없습니다.', 404);

  const moved = await moveMessage(
    settingsOf(account, env),
    String(ref.folder),
    ref.uidValidity,
    Number(ref.uid),
    String(to),
  );
  if (!moved) {
    throw new MailFnError('PROVIDER_UNAVAILABLE', '메일을 옮기지 못했습니다. 대상 폴더가 없을 수 있습니다.');
  }
  return { moved: true };
}
