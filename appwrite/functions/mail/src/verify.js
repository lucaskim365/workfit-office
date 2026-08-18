/**
 * 연결 확인 — IMAP·SMTP 인증이 실제로 되는지 본다.
 *
 * 계정을 저장하기 전에 이걸 통과시켜야 "등록은 됐는데 메일함이 안 열리는" 계정이 남지 않는다.
 * 연결은 매번 열고 닫는다(IDLE·풀 없음) — 함수 컨테이너는 실행 사이에 살아 있지 않아
 * 연결을 들고 있어 봐야 쓸모가 없다.
 */
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

const CONNECT_TIMEOUT = 10_000;

/**
 * 실패 원인을 정규화된 코드로 바꾼다.
 *
 * 서버 원문 메시지를 그대로 올리면 호스트·포트 같은 내부 정보가 화면까지 새고,
 * 사용자에게도 도움이 안 된다.
 */
export function classifyError(error) {
  const text = String(error?.message || error || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();

  if (text.includes('invalid credentials') || text.includes('authenticationfailed')
    || text.includes('auth') && text.includes('fail') || code === 'EAUTH') {
    return 'AUTH_FAILED';
  }
  if (code === 'ETIMEDOUT' || text.includes('timeout') || text.includes('timed out')) return 'TIMEOUT';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ECONNREFUSED') return 'UNREACHABLE';
  if (text.includes('certificate') || text.includes('tls') || text.includes('ssl')) return 'TLS_FAILED';
  return 'CONNECT_FAILED';
}

async function verifyImap(settings) {
  const client = new ImapFlow({
    host: settings.imap.host,
    port: settings.imap.port,
    secure: settings.imap.security === 'tls',
    doSTARTTLS: settings.imap.security === 'starttls',
    auth: { user: settings.authUsername, pass: settings.secret },
    logger: false,
    connectionTimeout: CONNECT_TIMEOUT,
    greetingTimeout: CONNECT_TIMEOUT,
    socketTimeout: 15_000,
  });

  try {
    await client.connect();
  } finally {
    // usable일 때만 logout한다. 연결에 실패한 클라이언트에 logout하면 또 던진다.
    if (client.usable) await client.logout();
  }
}

async function verifySmtp(settings) {
  const transporter = nodemailer.createTransport({
    host: settings.smtp.host,
    port: settings.smtp.port,
    secure: settings.smtp.security === 'tls',
    requireTLS: settings.smtp.security === 'starttls',
    auth: { user: settings.authUsername, pass: settings.secret },
    connectionTimeout: CONNECT_TIMEOUT,
    greetingTimeout: CONNECT_TIMEOUT,
    socketTimeout: 15_000,
  });

  try {
    await transporter.verify();
  } finally {
    transporter.close();
  }
}

/**
 * IMAP·SMTP 양쪽을 확인한다.
 *
 * 한쪽만 되는 경우가 실제로 있다(네이버는 IMAP과 SMTP 사용 설정이 별도). 어느 쪽이
 * 실패했는지 알려줘야 사용자가 메일 설정에서 고칠 수 있다.
 */
export async function verifyConnection(settings) {
  try {
    await verifyImap(settings);
  } catch (error) {
    return { ok: false, stage: 'imap', code: classifyError(error) };
  }

  try {
    await verifySmtp(settings);
  } catch (error) {
    return { ok: false, stage: 'smtp', code: classifyError(error) };
  }

  return { ok: true, stage: null, code: null };
}
