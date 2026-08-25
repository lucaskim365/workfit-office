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
import { inlineCidImages, sanitizeMailHtml } from './mailbox.js';
import { messageIdKey } from './sentBy.js';
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

/* ------------------------------------------------------------------ 본문 정화 */

test('스크립트와 이벤트 핸들러를 지운다', () => {
  const out = sanitizeMailHtml('<p onclick="steal()">본문</p><script>steal()</script>');
  assert.equal(out.includes('script'), false);
  assert.equal(out.includes('onclick'), false);
  assert.equal(out.includes('본문'), true);
});

test('서식과 표 레이아웃 속성을 남긴다', () => {
  // 이게 지워지면 디자인된 HTML 메일이 맨 텍스트 덩어리가 된다.
  const out = sanitizeMailHtml(
    '<table width="600" bgcolor="#ffffff"><tr><td style="color:#333;padding:8px;text-align:center">칸</td></tr></table>',
  );
  assert.equal(out.includes('width="600"'), true);
  assert.equal(out.includes('bgcolor="#ffffff"'), true);
  assert.equal(out.includes('color:#333'), true);
  assert.equal(out.includes('text-align:center'), true);
});

test('style 값에 숨긴 url()을 막는다', () => {
  // background로 외부 주소를 실으면 이미지 경로를 우회해 열람 추적이 된다.
  const out = sanitizeMailHtml('<p style="background-color:url(http://tracker.example/x.png)">본문</p>');
  assert.equal(out.includes('tracker.example'), false);
});

test('위치 지정 속성은 통과시키지 않는다', () => {
  // 화면 위에 겹쳐 다른 내용을 가리는 데 쓸 수 있다.
  const out = sanitizeMailHtml('<div style="position:fixed;color:red">본문</div>');
  assert.equal(out.includes('position'), false);
  assert.equal(out.includes('color:red'), true);
});

test('이미지는 http·https·data만 통과한다', () => {
  const out = sanitizeMailHtml(
    '<img src="https://ok.example/a.png"><img src="javascript:alert(1)"><img src="data:image/png;base64,AAAA">',
  );
  assert.equal(out.includes('https://ok.example/a.png'), true);
  assert.equal(out.includes('data:image/png;base64,AAAA'), true);
  assert.equal(out.includes('javascript:'), false);
});

test('cid 이미지를 data URI로 바꾼다', () => {
  // 브라우저는 cid:를 못 읽는다. 안 바꾸면 로고·서명이 전부 깨진 아이콘이 된다.
  const out = inlineCidImages('<img src="cid:logo@x">', [
    { cid: 'logo@x', contentType: 'image/png', content: Buffer.from('hello') },
  ]);
  assert.equal(out, `<img src="data:image/png;base64,${Buffer.from('hello').toString('base64')}">`);
});

test('꺾쇠로 감싼 contentId도 같은 것으로 본다', () => {
  const out = inlineCidImages('<img src="cid:logo@x">', [
    { contentId: '<logo@x>', contentType: 'image/png', content: Buffer.from('hi') },
  ]);
  assert.equal(out.includes('data:image/png;base64,'), true);
});

test('짝이 없는 cid는 건드리지 않는다', () => {
  const html = '<img src="cid:missing@x">';
  assert.equal(inlineCidImages(html, []), html);
});

/* ------------------------------------------------------------------ 발신 기록 */

test('꺾쇠가 있든 없든 같은 조인 키가 나온다', () => {
  // 발송 라이브러리와 IMAP 서버가 꺾쇠를 붙이는 방식이 달라, 여기서 어긋나면
  // 조인이 조용히 안 맞고 발신자 이름만 안 보인다.
  const withAngle = messageIdKey('<abc123@naver.com>');
  assert.equal(messageIdKey('abc123@naver.com'), withAngle);
  assert.equal(messageIdKey('  <abc123@naver.com>  '), withAngle);
});

test('조인 키는 길이가 64로 고정된다', () => {
  // 인덱스 키 길이 상한 때문에 해시를 쓴다. 길어지면 컬렉션 생성이 실패한다.
  assert.equal(messageIdKey('<x@y>').length, 64);
  assert.equal(messageIdKey(`<${'a'.repeat(500)}@example.com>`).length, 64);
});

test('다른 Message-ID는 다른 키가 된다', () => {
  assert.notEqual(messageIdKey('<a@x.com>'), messageIdKey('<b@x.com>'));
});

test('Message-ID가 없으면 빈 키다', () => {
  // 빈 키는 기록도 조회도 건너뛴다. 빈 값끼리 뭉쳐 엉뚱한 발신자가 붙으면 안 된다.
  assert.equal(messageIdKey(''), '');
  assert.equal(messageIdKey(null), '');
  assert.equal(messageIdKey(undefined), '');
  assert.equal(messageIdKey('<>'), '');
});

test('상한을 넘는 인라인 이미지는 바꾸지 않는다', () => {
  // 응답이 첨부 크기만큼 부푸는 것을 막는다. 일부라도 보이는 편이 낫다.
  const html = '<img src="cid:big@x"><img src="cid:small@x">';
  const out = inlineCidImages(html, [
    { cid: 'big@x', contentType: 'image/png', content: Buffer.alloc(5 * 1024 * 1024) },
    { cid: 'small@x', contentType: 'image/png', content: Buffer.from('ok') },
  ]);
  assert.equal(out.includes('cid:big@x'), true);
  assert.equal(out.includes('cid:small@x'), false);
});
