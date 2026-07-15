/**
 * Layer 1 인증 — 앱 세션에서 발급한 단기 JWT 검증.
 *
 * ⚠ 데모 한계: 앱에 실 백엔드/Firebase Auth 가 없어, 게이트웨이의 /api/auth/token 이
 *   앱 사용자 id 로 토큰을 즉석 발급한다(누구나 발급 가능). 운영에서는 앱 백엔드가
 *   로그인 검증 후에만 발급해야 한다. 방 멤버십 인가는 메신저 연결 단계에서 확장.
 */
import jwt from 'jsonwebtoken';

const { JWT_SECRET } = process.env;
if (!JWT_SECRET) throw new Error('JWT_SECRET 이 필요합니다(.env).');

export function issueToken({ userId, name }) {
  return jwt.sign({ sub: userId, name: name ?? userId }, JWT_SECRET, { expiresIn: '2h' });
}

/** Bearer 헤더 또는 ?t= 쿼리에서 토큰 추출·검증. 실패 시 null. */
export function verifyFromRequest(req) {
  const h = req.headers?.authorization ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  const raw = m?.[1] ?? req.query?.t ?? extractQueryToken(req.url);
  if (!raw) return null;
  try {
    return jwt.verify(raw, JWT_SECRET);
  } catch {
    return null;
  }
}

/** tus 핸들러는 express query 파싱을 안 거칠 수 있어 URL 에서 직접 t= 추출. */
function extractQueryToken(url) {
  if (!url) return null;
  const q = url.split('?')[1];
  if (!q) return null;
  for (const kv of q.split('&')) {
    const [k, v] = kv.split('=');
    if (k === 't') return decodeURIComponent(v ?? '');
  }
  return null;
}

/** Express 미들웨어: 검증 통과 시 req.user 세팅, 아니면 401. */
export function requireAuth(req, res, next) {
  const user = verifyFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  req.user = user;
  next();
}
