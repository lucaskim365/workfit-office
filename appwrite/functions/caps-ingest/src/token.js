/**
 * 요청자 신원 확인 — 서명 토큰에서 신뢰된 uid를 도출한다.
 *
 * 이 앱의 일반 로그인은 브라우저 안에서 끝나고(users 컬렉션을 내려받아 해시 대조) 서버는
 * 로그인 사실을 모른다. 그래서 요청 본문의 userId를 그대로 믿으면 아무나 남의 메일함을
 * 열 수 있다. `widdy-login` 함수가 로그인 시점에 발급하는 HMAC 서명 토큰만이 위조 불가능한
 * 신원 근거다. 검증 로직은 `widdy-chat`과 동일하다.
 *
 * ⚠ widdy-chat은 검증 실패 시 익명('')으로 강등해 계속 진행하지만, **메일은 거부해야 한다.**
 * 익명으로 열 수 있는 메일함은 없다. 호출부가 빈 문자열을 반드시 401로 다뤄야 한다.
 *
 * 나중에 Appwrite Auth로 갈아타거나 메일 전용 시크릿으로 분리할 때 바꿀 곳은 이 파일뿐이다.
 */
import crypto from 'crypto';

/**
 * 서명 토큰 검증 → uid. 실패하면 빈 문자열.
 *
 * 형식: `base64url({uid, exp})` + "." + `hex(hmac_sha256(payload, secret))`
 */
export function verifyToken(token, secret) {
  if (!token || !secret) return '';
  const dot = token.lastIndexOf('.');
  if (dot < 0) return '';

  const payloadPart = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(payloadPart).digest('hex');

  // 타이밍 안전 비교. 길이가 다르면 timingSafeEqual이 던지므로 먼저 거른다.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return '';

  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf-8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return ''; // 만료
    return String(payload.uid || '');
  } catch {
    return '';
  }
}

/**
 * 요청에서 신뢰된 사용자 ID를 얻는다. 없으면 빈 문자열.
 *
 * 토큰 위치를 여기 한 곳에 가둬 둔다. 호출부는 "요청 → uid"만 알면 된다.
 */
export function resolveUserId(body, env = process.env) {
  // 발급자(widdy-login)와 같은 순서로 키를 고른다. AUTH_TOKEN_SECRET이 정식 이름이고
  // 나머지는 기존 배포 호환용 폴백이다 — 발급 쪽과 값이 어긋나면 전부 401이 된다.
  const secret = env.AUTH_TOKEN_SECRET || env.MAIL_TOKEN_SECRET || env.WIDDY_TOKEN_SECRET || '';
  return verifyToken(String(body?.token || ''), secret);
}
