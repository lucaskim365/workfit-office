/**
 * Appwrite Function — Widdy 챗봇 게이트웨이 (Phase 3).
 * ([[Widdy_RAG_연계_개발_계획서.md]] §4 Phase 3 / §10.3 옵션 A)
 *
 * 웹/모바일 → 이 함수 → 내부 RAG /chat API(사설 10.10.1.53:8910) → 답변+출처.
 * RAG 는 사설망에만 있으므로 브라우저가 직접 접근하지 못하고, 이 함수만 중계한다.
 *
 *   요청(body):  { query, uid, history?, sessionId? }
 *   응답:        { answer, citations:[{docId,source,chunkIdx,url}], sessionId }
 *
 * env(함수 설정):
 *   WIDDY_RAG_URL        기본 http://10.10.1.53:8910/chat
 *   WIDDY_FUNCTION_TOKEN (선택) 스톱갭 Bearer 게이트. 설정 시 Authorization 검증.
 *
 * ⚠️ [인증] 현재 앱은 Appwrite Account 세션을 쓰지 않아 uid 를 body 로 받는다(위조 가능).
 *   운영 전, 앱 세션/서명 토큰으로 uid 를 '신뢰된' 방식으로 도출하도록 교체할 것.
 *   (sign-api 토큰 노출 이슈와 동일 유형 — 계획서 Phase 5 하드닝)
 */
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
    const uid = body.uid || '';
    if (!query || !uid) return res.json({ answer: '질문과 사용자 정보가 필요합니다.', citations: [] }, 400);

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
