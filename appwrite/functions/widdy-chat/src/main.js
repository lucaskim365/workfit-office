/**
 * Appwrite Function — Widdy 챗봇 게이트웨이 (Phase 3 + uid 하드닝).
 * ([[Widdy_RAG_연계_개발_계획서.md]] §4 Phase 3 / §10.3 옵션 A)
 *
 * 웹/모바일 → 이 함수 → 내부 RAG /chat API(사설 10.10.1.53:8910) → 답변+출처.
 * RAG 는 사설망에만 있으므로 브라우저가 직접 접근하지 못하고, 이 함수만 중계한다.
 *
 *   요청(body):  { query, token?, history?, sessionId? }
 *   응답:        { answer, citations:[{docId,source,chunkIdx,url}], sessionId }
 *
 * [인증 — uid 하드닝] uid 는 더 이상 body 로 신뢰하지 않는다(위조=ACL 우회).
 *   widdy-login 이 비밀번호 검증 후 발급한 **HMAC 서명 토큰**을 body.token 으로 받아
 *   여기서 서명·만료를 검증하고 그 안의 uid 만 신뢰해 RAG 로 전달한다.
 *   토큰 없음/무효 → 익명(uid='')으로 강등 → RAG 는 public 문서 + 일반질문만 응답.
 *   (sign-api 토큰 노출 이슈와 동일 유형 — [[sign-api-token-client-exposed]])
 *
 * env(함수 설정):
 *   WIDDY_RAG_URL        기본 http://10.10.1.53:8910/chat
 *   WIDDY_TOKEN_SECRET   ★widdy-login 과 동일한 HMAC 시크릿(토큰 검증용)
 *   WIDDY_FUNCTION_TOKEN (선택) 스톱갭 Bearer 게이트. 설정 시 Authorization 검증.
 */
import crypto from 'crypto';

/** widdy-login 이 발급한 `base64url(payload).hex(hmac)` 토큰 검증 → uid|''. */
function verifyToken(token, secret) {
  if (!token || !secret) return '';
  const dot = token.lastIndexOf('.');
  if (dot < 0) return '';
  const p = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expect = crypto.createHmac('sha256', secret).update(p).digest('hex');
  // 타이밍 안전 비교(길이 다르면 즉시 실패)
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return '';
  try {
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf-8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return ''; // 만료
    return String(payload.uid || '');
  } catch {
    return '';
  }
}

export default async ({ req, res, log, error }) => {
  try {
    // 스톱갭 토큰 게이트(선택)
    const gate = process.env.WIDDY_FUNCTION_TOKEN || '';
    if (gate) {
      const auth = req.headers['authorization'] || req.headers['Authorization'] || '';
      if (auth !== `Bearer ${gate}`) return res.json({ answer: '인증이 필요합니다.', citations: [] }, 401);
    }

    const body = req.bodyJson || {};
    const query = (body.query || '').trim();
    if (!query) return res.json({ answer: '질문을 입력해 주세요.', citations: [] }, 400);

    // ★신뢰된 uid = 서명 토큰에서만 도출. 무효/없음 → 익명('') → public+일반질문만.
    const uid = verifyToken(body.token || '', process.env.WIDDY_TOKEN_SECRET || '');

    const RAG = process.env.WIDDY_RAG_URL || 'http://10.10.1.53:8910/chat';
    const r = await fetch(RAG, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, uid, history: body.history || [], sessionId: body.sessionId || '' }),
      signal: AbortSignal.timeout(120000),
    });
    if (!r.ok) {
      error(`RAG ${r.status}`);
      return res.json({ answer: `RAG 게이트웨이 오류 (${r.status})`, citations: [] }, 502);
    }
    return res.json(await r.json());
  } catch (e) {
    error('widdy-chat error: ' + e.message);
    return res.json({ answer: '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', citations: [], error: e.message }, 500);
  }
};
