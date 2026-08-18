/**
 * mail Function 순수 로직 테스트 — 암호화와 신원 토큰.
 *
 * 실행: node --test appwrite/functions/mail/src/mail.test.js
 *
 * 여기 있는 것은 Appwrite도 IMAP도 필요 없는 부분만이다. 자격 증명 처리와 토큰 검증은
 * 틀리면 조용히 뚫리는 자리라 배포 전에 반드시 걸러야 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { assertCredentialKey, decryptSecret, encryptSecret } from './credentials.js';
import { verifyToken } from './token.js';

const env = { MAIL_CREDENTIALS_KEY: crypto.randomBytes(32).toString('base64url') };

test('암호문을 원래 값으로 되돌린다', () => {
  const secret = '앱비번 abc!@#';
  assert.equal(decryptSecret(encryptSecret(secret, env), env), secret);
});

test('저장 형식은 v1 네 조각이다', () => {
  const parts = encryptSecret('x', env).split('.');
  assert.equal(parts.length, 4);
  assert.equal(parts[0], 'v1');
});

test('같은 값도 매번 다른 암호문이 된다', () => {
  // IV를 매번 새로 뽑지 않으면 같은 비밀번호를 쓰는 계정이 서로 드러난다.
  assert.notEqual(encryptSecret('x', env), encryptSecret('x', env));
});

test('암호문을 고치면 복호화가 실패한다', () => {
  const parts = encryptSecret('x', env).split('.');
  parts[3] = Buffer.from('tampered').toString('base64url');
  assert.throws(() => decryptSecret(parts.join('.'), env), /복호화하지 못/);
});

test('다른 키로는 풀리지 않는다', () => {
  const other = { MAIL_CREDENTIALS_KEY: crypto.randomBytes(32).toString('base64url') };
  assert.throws(() => decryptSecret(encryptSecret('x', env), other), /복호화하지 못/);
});

test('32바이트가 아닌 키는 거부한다', () => {
  const short = { MAIL_CREDENTIALS_KEY: crypto.randomBytes(16).toString('base64url') };
  assert.throws(() => assertCredentialKey(short), /올바르게 설정/);
});

// ── 신원 토큰 ──

const SECRET = 'token-secret-for-test';

const mint = (uid, ttl = 3600) => {
  const payload = Buffer.from(
    JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + ttl }),
  ).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', SECRET).update(payload).digest('hex')}`;
};

test('정상 토큰에서 uid를 얻는다', () => {
  assert.equal(verifyToken(mint('U009'), SECRET), 'U009');
});

test('uid를 바꿔치기한 토큰을 거부한다', () => {
  // 남의 메일함을 여는 가장 직접적인 공격. payload만 바꾸고 서명은 그대로 붙인 경우다.
  const forged = Buffer.from(
    JSON.stringify({ uid: 'U001', exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  const stolenSignature = mint('U009').split('.')[1];
  assert.equal(verifyToken(`${forged}.${stolenSignature}`, SECRET), '');
});

test('만료된 토큰을 거부한다', () => {
  assert.equal(verifyToken(mint('U009', -10), SECRET), '');
});

test('토큰이나 시크릿이 없으면 거부한다', () => {
  assert.equal(verifyToken('', SECRET), '');
  assert.equal(verifyToken(mint('U009'), ''), '');
});
