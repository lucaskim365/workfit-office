/**
 * IMAP 조작 — MailHub `imap.client.ts` 이식.
 *
 * 연결은 매번 열고 닫는다(IDLE·커넥션 풀 없음). 함수 컨테이너는 실행 사이에 살아 있지 않아
 * 연결을 들고 있어 봐야 쓸모가 없고, `finally`에서 반드시 로그아웃해 계정당 세션 상한에
 * 걸리지 않게 한다.
 */
import { ImapFlow } from 'imapflow';

/** 논리 폴더. 공급자·언어 설정마다 실제 폴더 이름이 달라 호출부는 이 이름만 쓴다. */
export const LOGICAL_FOLDERS = ['INBOX', 'SENT', 'DRAFTS', 'TRASH'];

const SPECIAL_USE = {
  INBOX: null,
  SENT: '\\Sent',
  DRAFTS: '\\Drafts',
  TRASH: '\\Trash',
};

/** special-use 플래그를 안 주는 서버용 이름 후보. 소문자로 비교한다. */
const FALLBACK_NAMES = {
  INBOX: ['inbox'],
  SENT: ['sent', 'sent messages', 'sent items', '보낸메일함', '보낸편지함'],
  DRAFTS: ['drafts', '임시보관함', '임시 보관함', '임시보관'],
  TRASH: ['trash', 'deleted messages', 'deleted items', '휴지통', '지운메일함'],
};

/**
 * 검색용 소켓 타임아웃.
 *
 * 본문 검색(`BODY`)은 서버가 메일함 전체를 훑어 목록 조회보다 훨씬 오래 걸린다. 기본
 * 15초로는 중간 크기 메일함에서도 끊긴다.
 */
const SEARCH_SOCKET_TIMEOUT = 60_000;

function createClient(settings, socketTimeout = 15_000) {
  return new ImapFlow({
    host: settings.imap.host,
    port: settings.imap.port,
    secure: settings.imap.security === 'tls',
    doSTARTTLS: settings.imap.security === 'starttls',
    auth: { user: settings.authUsername, pass: settings.secret },
    logger: false,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout,
  });
}

/** 연결을 열어 작업하고 반드시 닫는다. */
async function withClient(settings, run, socketTimeout) {
  const client = createClient(settings, socketTimeout);
  try {
    await client.connect();
    return await run(client);
  } finally {
    // 연결에 실패한 클라이언트에 logout하면 또 던진다.
    if (client.usable) await client.logout();
  }
}

/**
 * 논리 폴더 → 실제 IMAP 경로.
 *
 * special-use 플래그를 먼저 보고, 없으면 이름으로 찾는다. 둘 다 실패하면 null이고 호출부는
 * "그 폴더가 없는 계정"으로 다룬다. 짐작해서 아무 폴더나 열지 않는다 — 엉뚱한 폴더를 조용히
 * 열면 사용자는 자기 메일이 사라진 줄 안다.
 */
async function resolveMailboxPath(client, folder) {
  if (folder === 'INBOX') return 'INBOX';

  const boxes = await client.list();
  const flag = SPECIAL_USE[folder];
  const bySpecialUse = boxes.find((box) => box.specialUse === flag);
  if (bySpecialUse) return bySpecialUse.path;

  const names = FALLBACK_NAMES[folder] ?? [];
  const byName = boxes.find((box) => names.includes(String(box.name).trim().toLowerCase()));
  return byName?.path ?? null;
}

/** 첨부 존재 여부는 `BODYSTRUCTURE`만 보고 판단한다. 본문을 안 받아 목록이 느려지지 않는다. */
function hasAttachmentPart(node) {
  if (!node) return false;
  if (String(node.disposition || '').toLowerCase() === 'attachment') return true;
  return (node.childNodes ?? []).some(hasAttachmentPart);
}

/** 계정에서 실제로 쓸 수 있는 논리 폴더. 없는 폴더를 화면에 열어 두지 않기 위해 쓴다. */
export async function listAvailableFolders(settings) {
  return withClient(settings, async (client) => {
    const found = [];
    for (const folder of LOGICAL_FOLDERS) {
      if (await resolveMailboxPath(client, folder)) found.push(folder);
    }
    return found;
  });
}

/** 받은메일함의 안 읽은 수. `STATUS` 한 번이라 목록 조회보다 훨씬 싸다. */
export async function countUnseenInbox(settings) {
  return withClient(settings, async (client) => {
    const status = await client.status('INBOX', { unseen: true });
    return status.unseen ?? 0;
  });
}

/**
 * 폴더별 메일 목록.
 *
 * 검색은 서버 `SEARCH`로 처리한다. 받아온 목록을 클라이언트에서 거르면 조회 상한 밖의
 * 메일은 아예 걸리지 않아 "검색해도 안 나온다"가 된다.
 */
export async function fetchMessages(settings, folder, limit, query = {}) {
  const text = String(query.text || '').trim();
  const searching = Boolean(text) || query.unseenOnly === true || query.flaggedOnly === true;

  return withClient(settings, async (client) => {
    const path = await resolveMailboxPath(client, folder);
    if (!path) return [];

    const mailbox = await client.mailboxOpen(path, { readOnly: true });
    if (mailbox.exists === 0) return [];

    let range = `${Math.max(1, mailbox.exists - limit + 1)}:*`;

    if (searching) {
      const criteria = {};
      if (query.unseenOnly) criteria.seen = false;
      if (query.flaggedOnly) criteria.flagged = true;
      // 본문까지 넣어야 "내용으로 찾기"가 된다.
      if (text) criteria.or = [{ subject: text }, { from: text }, { body: text }];

      /*
        imapflow는 검색이 거절되면 예외 대신 false를 돌려준다. false를 빈 결과로 다루면
        "검색 실패"가 "결과 없음"으로 둔갑해 사용자가 메일이 없는 줄 알게 된다.
      */
      let uids;
      try {
        uids = await client.search(criteria, { uid: true });
      } catch (e) {
        throw new Error(`IMAP 검색에 실패했습니다: ${e?.message || e}`);
      }
      if (uids === false) throw new Error('IMAP 서버가 검색을 처리하지 못했습니다.');
      if (uids.length === 0) return [];
      // 최근 것부터 상한만큼만. 오래된 것까지 다 받으면 느리고 쓸모도 적다.
      range = uids.slice(-limit);
    }

    const fetchQuery = {
      uid: true,
      envelope: true,
      internalDate: true,
      flags: true,
      bodyStructure: true,
    };
    const messages = Array.isArray(range)
      ? await client.fetchAll(range, fetchQuery, { uid: true })
      : await client.fetchAll(range, fetchQuery);

    return messages.map((message) => {
      // 보낸메일함에서는 보낸 사람이 항상 나라서 받는 사람을 보여야 목록이 쓸모 있다.
      const counterpart = folder === 'SENT'
        ? message.envelope?.to?.[0]
        : message.envelope?.from?.[0] ?? message.envelope?.sender?.[0];
      const receivedAt = message.envelope?.date ?? message.internalDate ?? new Date(0);

      return {
        uid: message.uid,
        uidValidity: mailbox.uidValidity.toString(),
        subject: message.envelope?.subject?.trim() || '(제목 없음)',
        senderAddress: counterpart?.address,
        senderName: counterpart?.name,
        recipients: (message.envelope?.to ?? []).map((row) => ({ address: row.address, name: row.name })),
        receivedAt: receivedAt instanceof Date ? receivedAt : new Date(receivedAt),
        seen: message.flags?.has('\\Seen') ?? false,
        answered: message.flags?.has('\\Answered') ?? false,
        flagged: message.flags?.has('\\Flagged') ?? false,
        hasAttachment: hasAttachmentPart(message.bodyStructure),
      };
    });
  }, searching ? SEARCH_SOCKET_TIMEOUT : undefined);
}

/**
 * 원문 가져오기. 읽으면서 `\Seen`을 함께 단다.
 *
 * `uidValidity` 세대가 다르면 같은 UID라도 다른 메일이므로 건드리지 않고 null을 준다.
 */
export async function fetchMessageSource(settings, folder, uidValidity, uid) {
  return withClient(settings, async (client) => {
    const path = await resolveMailboxPath(client, folder);
    if (!path) return null;

    const mailbox = await client.mailboxOpen(path);
    if (mailbox.uidValidity.toString() !== String(uidValidity)) return null;

    const message = await client.fetchOne(uid, { source: true, flags: true }, { uid: true });
    if (!message || !message.source) return null;

    const wasSeen = message.flags?.has('\\Seen') ?? false;
    if (!wasSeen) await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true, silent: true });

    return { source: message.source, wasSeen, uidValidity: mailbox.uidValidity.toString() };
  });
}

/**
 * 읽음·별표 일괄 표시.
 *
 * 같은 메일함의 UID 여러 개를 한 연결로 처리한다 — 메일마다 연결을 열면 "모두 읽음" 한 번에
 * IMAP 접속이 목록 길이만큼 일어난다.
 */
export async function applyFlag(settings, folder, uidValidity, uids, flag, on) {
  if (uids.length === 0) return true;

  return withClient(settings, async (client) => {
    const path = await resolveMailboxPath(client, folder);
    if (!path) return false;

    const mailbox = await client.mailboxOpen(path);
    if (mailbox.uidValidity.toString() !== String(uidValidity)) return false;

    const range = uids.join(',');
    return on
      ? client.messageFlagsAdd(range, [flag], { uid: true, silent: true })
      : client.messageFlagsRemove(range, [flag], { uid: true, silent: true });
  });
}

/**
 * 폴더 간 이동. 휴지통 이동이 이 함수를 쓴다.
 *
 * 영구 삭제(`\Deleted` + `EXPUNGE`)는 되돌릴 수 없어 열지 않는다. 대상 폴더가 없으면
 * 이동하지 않고 실패를 알린다 — 없는 폴더로 옮긴다며 원본을 지우면 메일이 사라진다.
 */
export async function moveMessage(settings, from, uidValidity, uid, to) {
  return withClient(settings, async (client) => {
    const sourcePath = await resolveMailboxPath(client, from);
    const targetPath = await resolveMailboxPath(client, to);
    if (!sourcePath || !targetPath || sourcePath === targetPath) return false;

    const mailbox = await client.mailboxOpen(sourcePath);
    if (mailbox.uidValidity.toString() !== String(uidValidity)) return false;

    await client.messageMove(uid, targetPath, { uid: true });
    return true;
  });
}
