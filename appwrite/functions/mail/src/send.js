/**
 * 발송·첨부 — MailHub `sendMail` action과 `smtp.client.ts` 이식.
 *
 * 답장·전달의 스레드 헤더는 클라이언트가 보낸 값을 믿지 않고 **서버가 원문을 다시 읽어**
 * 만든다. 위조된 헤더로 남의 대화에 끼어드는 것을 막고, 헤더가 빠져 받는 쪽에서 답장이
 * 새 대화로 뜨는 것도 막는다.
 */
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import { Query } from 'node-appwrite';
import { decryptSecret } from './credentials.js';
import { connectionSettings } from './providers.js';
import { fetchMessageSource, applyFlag } from './imap.js';
import { MailFnError } from './accounts.js';

const COLLECTION = 'mailAccounts';
const USERS_COLLECTION = 'users';
/** 발신 기록. 어느 그룹웨어 계정이 보냈는지를 우리 쪽에 남긴다. */
const SENT_BY_COLLECTION = 'mailSentBy';

/** 첨부 총량 상한(풀어본 바이트 기준). MailHub와 동일. */
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

/**
 * 발송용 소켓 타임아웃.
 *
 * 발송은 본문과 첨부를 모두 올릴 때까지 소켓을 잡고 있다. 첨부가 몇 MB만 되어도 15초를
 * 넘기고, 그러면 접속 실패와 같은 ETIMEDOUT이 나 원인을 오해하게 된다. 함수 자체 timeout이
 * 이 값보다 커야 한다(appwrite.json 150초).
 */
const SEND_SOCKET_TIMEOUT = 120_000;

async function ownedAccount(dbs, dbId, uid, accountId) {
  const found = await dbs.listDocuments(dbId, COLLECTION, [
    Query.equal('workfitUserId', uid),
    Query.equal('id', String(accountId || '')),
    Query.limit(1),
  ]);
  return found.documents[0] ?? null;
}

const settingsOf = (account, env) => connectionSettings(account, decryptSecret(account.encryptedSecret, env));

/**
 * 발신자 표시 이름 — 그룹웨어 계정 이름.
 *
 * 메일 계정의 `displayName`이 아니라 **사람 이름**을 쓴다. 계정 표시 이름은 "업무용 네이버"
 * 같은 별칭 용도로 안내되고 있고, 공용 계정이면 B와 C가 같은 값을 보게 된다.
 * 그룹웨어 계정 이름은 보낸 사람마다 다르므로 공용 계정에서도 사람이 갈린다.
 *
 * 못 읽어도 발송은 막지 않는다 — 이름 없이 주소만 나가는 것이 못 보내는 것보다 낫다.
 */
async function senderNameOf(dbs, dbId, uid, log) {
  try {
    const user = await dbs.getDocument(dbId, USERS_COLLECTION, uid);
    return String(user?.name || '').trim();
  } catch (e) {
    log?.(`senderNameOf: 사용자 이름을 읽지 못했습니다 uid=${uid} msg=${String(e?.message).slice(0, 120)}`);
    return '';
  }
}

/**
 * 발신 기록 저장.
 *
 * 보낸메일함은 IMAP 서버에 있고 거기엔 헤더뿐이라, 공용 계정을 여럿이 쓰면 "우리 팀 누가
 * 보냈나"를 알 수 없다. From 표시 이름으로도 대개 갈리지만 그건 문자열이라 동명이인이면
 * 겹치고 공급자가 고쳐 쓸 수도 있다. `Message-ID`를 키로 확정 정보를 우리 쪽에 남긴다.
 *
 * 실패해도 발송은 이미 끝났다. 기록을 못 남겼다고 오류를 돌려주면 같은 메일을 다시 보낸다.
 */
async function recordSender(dbs, dbId, { messageId, accountId, uid, senderName }, log) {
  if (!messageId) return;
  try {
    const id = randomUUID().replace(/-/g, '').slice(0, 24);
    await dbs.createDocument(dbId, SENT_BY_COLLECTION, id, {
      id,
      messageId: String(messageId).slice(0, 512),
      accountId: String(accountId || ''),
      workfitUserId: String(uid || ''),
      senderName: String(senderName || '').slice(0, 30),
      sentAt: new Date().toISOString(),
    });
  } catch (e) {
    log?.(`recordSender: 발신 기록을 남기지 못했습니다 msg=${String(e?.message).slice(0, 120)}`);
  }
}

/** `이름 <주소>` 형식. 이름이 없으면 주소만. */
const formatAddress = (row) => (row?.name ? `${row.name} <${row.email}>` : row?.email || '');
const formatList = (rows) => {
  const list = (rows ?? []).map(formatAddress).filter(Boolean);
  return list.length > 0 ? list.join(', ') : undefined;
};

/** 원문에서 스레드 헤더를 만든다. references에 messageId를 이어 붙이는 것이 RFC 5322 관례다. */
function threadHeadersOf(parsed) {
  const refs = Array.isArray(parsed.references)
    ? [...parsed.references]
    : (parsed.references ? [parsed.references] : []);
  if (parsed.messageId && !refs.includes(parsed.messageId)) refs.push(parsed.messageId);
  return {
    inReplyTo: parsed.messageId || undefined,
    references: refs.length > 0 ? refs : undefined,
  };
}

/**
 * 발송 실패를 원인별 코드로 바꾼다.
 *
 * 전부 하나로 뭉치면 사용자가 볼 문구가 "일시적으로 응답하지 않습니다" 하나뿐이라,
 * 앱 비밀번호가 막힌 것인지 주소가 틀린 것인지 첨부가 큰 것인지 알 수 없다.
 * 서버 내부 메시지는 싣지 않는다.
 */
function classifySendError(error) {
  const code = String(error?.code || '');
  const responseCode = Number(error?.responseCode || 0);

  if (code === 'EAUTH') {
    return new MailFnError('AUTH_FAILED', '발신 계정 인증에 실패했습니다. 앱 비밀번호를 확인하세요.', 502);
  }
  if (code === 'EENVELOPE') {
    return new MailFnError('SEND_RECIPIENT_REJECTED', '받는 사람 주소를 메일 서버가 거절했습니다. 주소를 확인하세요.', 400);
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') {
    return new MailFnError('SEND_TIMEOUT', '메일 서버 응답이 없어 발송하지 못했습니다. 잠시 후 다시 시도하세요.', 504);
  }
  if (responseCode === 552 || responseCode === 523) {
    return new MailFnError('SEND_TOO_LARGE', '메일이 너무 커서 보낼 수 없습니다. 첨부를 줄여 주세요.', 413);
  }
  return new MailFnError('SEND_FAILED', '메일을 보내지 못했습니다. 잠시 후 다시 시도하세요.', 502);
}

/** 원문을 읽어 파싱한다. 없으면 null. 스레드 헤더·전달 첨부가 이걸 쓴다. */
async function loadOrigin(account, origin, env) {
  const source = await fetchMessageSource(
    settingsOf(account, env),
    String(origin.folder || 'INBOX'),
    String(origin.uidValidity || ''),
    Number(origin.uid || 0),
  );
  if (!source) return null;
  return simpleParser(source.source, { skipHtmlToText: true, skipTextToHtml: true });
}

/**
 * 메일 발송.
 *
 * input 형태는 화면 도메인 `SendMailInput` 그대로다(주소는 {name,email} 배열).
 * 발신 주소는 요청이 아니라 **계정 문서에서** 읽는다 — 요청의 from을 믿으면 소유하지 않은
 * 주소로 발신을 위장할 수 있다.
 */
export async function sendMail(dbs, dbId, uid, input, env, log) {
  const account = await ownedAccount(dbs, dbId, uid, input?.accountId);
  if (!account) throw new MailFnError('NOT_FOUND', '발신 계정을 찾을 수 없습니다.', 404);

  const to = formatList(input?.to);
  if (!to) throw new MailFnError('NO_RECIPIENT', '받는 사람을 입력하세요.', 400);

  // 답장·전달의 원본 연결. 원본은 발신 계정과 다른 계정에 있을 수 있다.
  let threading = {};
  let forwarded = [];
  const origin = input?.origin ?? null;
  if (origin?.mode) {
    const originAccount = origin.ref?.accountId === account.id
      ? account
      : await ownedAccount(dbs, dbId, uid, origin.ref?.accountId);
    if (!originAccount) throw new MailFnError('NOT_FOUND', '원본 메일 계정을 찾을 수 없습니다.', 404);

    const parsed = await loadOrigin(originAccount, origin.ref ?? {}, env);
    if (parsed) {
      threading = threadHeadersOf(parsed);
      if (origin.mode === 'forward') {
        /*
          전달은 원문 첨부를 그대로 싣는다. 인라인 이미지도 뺴지 않는다 — 본문 HTML이
          그 이미지를 참조하고 있어 빼면 전달된 메일의 본문이 깨진다.
        */
        forwarded = parsed.attachments.map((row, index) => ({
          filename: String(row.filename || `첨부${index + 1}`).trim(),
          contentType: row.contentType || 'application/octet-stream',
          content: row.content,
          cid: row.cid,
        }));
      }
    }
  }

  /*
    작성 화면에서 올린 첨부. 상한은 클라이언트가 보낸 size가 아니라 **풀어본 바이트 수**로
    검사한다. 전달 첨부와 합산해 넘으면 조용히 빼지 않고 실패로 알린다 — 빼고 보내면
    받는 쪽은 첨부가 있었다는 사실을 모른다.
  */
  const uploaded = (Array.isArray(input?.attachments) ? input.attachments : []).map((row, index) => ({
    filename: String(row?.filename || `attachment${index + 1}`),
    contentType: String(row?.contentType || 'application/octet-stream'),
    content: Buffer.from(String(row?.base64 || ''), 'base64'),
  }));
  const attachments = [...forwarded, ...uploaded];
  const totalBytes = attachments.reduce((sum, file) => sum + (file.content?.byteLength ?? 0), 0);
  if (totalBytes > MAX_ATTACHMENT_BYTES) {
    throw new MailFnError('SEND_ATTACHMENT_TOO_LARGE', '첨부 총량이 20MB를 넘어 보낼 수 없습니다. 첨부를 줄여 주세요.', 413);
  }

  const settings = settingsOf(account, env);
  const transporter = nodemailer.createTransport({
    host: settings.smtp.host,
    port: settings.smtp.port,
    secure: settings.smtp.security === 'tls',
    requireTLS: settings.smtp.security === 'starttls',
    auth: { user: settings.authUsername, pass: settings.secret },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: SEND_SOCKET_TIMEOUT,
  });

  const senderName = await senderNameOf(dbs, dbId, uid, log);

  let info;
  try {
    info = await transporter.sendMail({
      // 이름이 있으면 `허진욱 <a@naver.com>`으로 나간다. 받는 쪽도 주소 대신 사람을 본다.
      from: senderName ? { name: senderName, address: account.email } : account.email,
      to,
      cc: formatList(input?.cc),
      bcc: formatList(input?.bcc),
      subject: String(input?.subject ?? ''),
      text: String(input?.textBody ?? ''),
      inReplyTo: threading.inReplyTo,
      references: threading.references,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  } catch (error) {
    throw classifySendError(error);
  } finally {
    transporter.close();
  }

  // 발송은 끝났다. 이 아래는 전부 실패해도 오류로 돌려주지 않는다 — 다시 보내게 된다.
  await recordSender(
    dbs,
    dbId,
    { messageId: info?.messageId, accountId: account.id, uid, senderName },
    log,
  );

  // 답장 플래그를 못 달았다고 실패로 돌려주면 같은 메일을 다시 보내게 된다.
  if (origin?.mode && origin.mode !== 'forward') {
    try {
      const originAccount = origin.ref?.accountId === account.id
        ? account
        : await ownedAccount(dbs, dbId, uid, origin.ref?.accountId);
      if (originAccount) {
        await applyFlag(
          settingsOf(originAccount, env),
          String(origin.ref?.folder || 'INBOX'),
          String(origin.ref?.uidValidity || ''),
          [Number(origin.ref?.uid || 0)],
          '\\Answered',
          true,
        );
      }
    } catch {
      /* 무시 */
    }
  }

  // savedTo: 공급자가 보낸편지함 위치를 알려주지 않는다. 화면은 성공만 표시한다.
  return { savedTo: null, sentAt: new Date().toISOString() };
}

/**
 * 첨부 하나 내려받기 — base64로 돌려준다.
 *
 * 상세에는 메타데이터만 실리고 내용은 누를 때 받는다. 인라인 이미지를 뺀 순번이 상세의
 * `attachments[].index`와 같아야 하므로 필터를 동일하게 건다.
 */
export async function getAttachment(dbs, dbId, uid, ref, index, env) {
  const account = await ownedAccount(dbs, dbId, uid, ref?.accountId);
  if (!account) throw new MailFnError('NOT_FOUND', '계정을 찾을 수 없습니다.', 404);

  const source = await fetchMessageSource(
    settingsOf(account, env),
    String(ref?.folder || 'INBOX'),
    String(ref?.uidValidity || ''),
    Number(ref?.uid || 0),
  );
  if (!source) throw new MailFnError('NOT_FOUND', '메일을 찾을 수 없습니다. 다른 기기에서 지웠을 수 있습니다.', 404);

  const parsed = await simpleParser(source.source, { skipHtmlToText: true, skipTextToHtml: true });
  const real = parsed.attachments.filter((row) => row.related !== true);
  const found = real[Number(index)];
  if (!found) throw new MailFnError('NOT_FOUND', '첨부를 찾을 수 없습니다. 메일이 지워졌을 수 있습니다.', 404);

  const content = found.content;
  /*
    base64는 원본의 약 4/3 크기다. 20MB 원본이면 응답이 27MB로 부푼다. Appwrite 실행 응답
    한도를 넘으면 빈 응답이 나가 원인을 알 수 없게 되므로, 상한을 넘는 첨부는 명확한
    오류로 알린다. 더 큰 첨부는 Storage 경유 방식을 붙일 때 연다.
  */
  if (content.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new MailFnError('ATTACHMENT_TOO_LARGE', '첨부가 너무 커서 내려받을 수 없습니다. 메일 서비스에서 직접 받으세요.', 413);
  }

  return {
    filename: String(found.filename || '첨부').trim(),
    contentType: found.contentType || 'application/octet-stream',
    size: content.byteLength,
    base64: content.toString('base64'),
  };
}
