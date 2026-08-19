/**
 * 앱 비밀번호 암·복호화 — AES-256-GCM.
 *
 * 저장 형식: `v1.{iv}.{authTag}.{ciphertext}` (각 조각 base64url, IV 12바이트)
 *
 * 왜 컬렉션 권한만으로 부족한가: `mailAccounts`는 서버 전용 권한이라 브라우저는 못 붙지만,
 * **Appwrite API 키를 가진 쪽은 row를 그대로 읽는다.** 앱 비밀번호는 메일함 전체를 여는
 * 열쇠라 값 자체를 암호화해 둬야 한다.
 *
 * 평문은 어디에도 저장하지 않는다. 복호화는 IMAP·SMTP 인증에 넘기기 직전 1회뿐이고
 * 캐시하지 않는다.
 *
 * 키(`MAIL_CREDENTIALS_KEY`)는 base64url 인코딩된 **정확히 32바이트**여야 한다.
 * 생성: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export class CredentialConfigError extends Error {
  constructor(message = '메일 자격 증명 암호화 키가 올바르게 설정되지 않았습니다.') {
    super(message);
    this.name = 'CredentialConfigError';
  }
}

function readKey(env = process.env) {
  const encoded = env.MAIL_CREDENTIALS_KEY;
  if (!encoded) throw new CredentialConfigError();

  const key = Buffer.from(encoded, 'base64url');
  if (key.length !== 32) throw new CredentialConfigError();
  return key;
}

/** 설정이 유효한지만 확인한다. 함수 시작 시 빠르게 실패시키는 용도. */
export function assertCredentialKey(env = process.env) {
  readKey(env);
}

export function encryptSecret(plaintext, env = process.env) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', readKey(env), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptSecret(encrypted, env = process.env) {
  const [version, iv, authTag, ciphertext] = String(encrypted || '').split('.');
  if (version !== 'v1' || !iv || !authTag || !ciphertext) throw new CredentialConfigError();

  try {
    const decipher = createDecipheriv('aes-256-gcm', readKey(env), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // 키가 바뀌었거나 값이 변조된 경우. 어느 쪽인지 밖으로 흘리지 않는다.
    throw new CredentialConfigError('저장된 자격 증명을 복호화하지 못했습니다.');
  }
}
