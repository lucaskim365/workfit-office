/**
 * Appwrite Function — mail: 메일 계정 관리와 IMAP·SMTP 연결.
 *
 * MailHub(Next.js) 개발 브리지를 대체한다. 메일은 IMAP·SMTP(TCP)라 브라우저에서 직접
 * 열 수 없어 서버가 반드시 필요하다.
 *
 *   요청:  POST { token, action, payload }
 *   응답:  { data } | { error: { code, message } }
 *
 * 신원 확인: `token`은 로그인 시 `widdy-login`이 발급한 HMAC 서명 토큰이다. 요청 본문의
 *   userId를 믿지 않는다 — 브라우저가 쓰는 값이라 위조된다. (`src/token.js` 참고)
 *
 * env(함수 설정):
 *   MAIL_CREDENTIALS_KEY  ★앱 비밀번호 암호화 키. base64url 32바이트. 노출 시 전 계정 재등록.
 *   MAIL_TOKEN_SECRET     신원 토큰 HMAC 시크릿. 없으면 WIDDY_TOKEN_SECRET 을 쓴다.
 *   APPWRITE_DATABASE_ID  기본 'workfit'
 * scopes: databases.read/write, documents.read/write (mailAccounts 접근)
 */
import { Client, Databases } from 'node-appwrite';
import { resolveUserId } from './token.js';
import { assertCredentialKey } from './credentials.js';
import {
  MailFnError,
  createAccount,
  deleteAccount,
  listAccounts,
  testConnection,
  updateAccount,
} from './accounts.js';

const DB = process.env.APPWRITE_DATABASE_ID || 'workfit';

/**
 * 어느 키로 붙을지.
 *
 * 원래는 동적 키(`x-appwrite-key`)만 썼다. 함수에 정적 API 키를 심지 않는 쪽이 안전하기
 * 때문이다. 그런데 동적 키로는 `createDocument`가 예외 없이 `$id` 없는 값을 돌려주고
 * 문서가 남지 않는 현상이 있었다(읽기와 수정은 정상). 원인이 밝혀질 때까지 `APPWRITE_API_KEY`가
 * 설정돼 있으면 그쪽을 먼저 쓴다. 원인이 확인되면 동적 키로 되돌린다.
 */
function resolveKey(req) {
  const staticKey = process.env.APPWRITE_API_KEY;
  if (staticKey) return { key: staticKey, kind: 'static' };
  return { key: req.headers['x-appwrite-key'], kind: 'dynamic' };
}

function databases(req) {
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
  const { key } = resolveKey(req);
  return new Databases(new Client().setEndpoint(endpoint).setProject(projectId).setKey(key));
}

export default async ({ req, res, log, error }) => {
  const fail = (code, message, status = 400) => res.json({ error: { code, message } }, status);

  try {
    // 키가 없으면 등록도 조회도 의미가 없다. 요청을 처리하기 전에 먼저 끊는다.
    assertCredentialKey();
  } catch {
    error('mail: MAIL_CREDENTIALS_KEY 미설정 또는 형식 오류');
    return fail('SERVER_NOT_CONFIGURED', '메일 서버 설정이 완료되지 않았습니다.', 500);
  }

  /**
   * 본문 파싱.
   *
   * `req.bodyJson`은 본문이 비었거나 JSON이 아니면 **접근하는 순간 던진다**. 핸들러 밖으로
   * 새면 런타임이 본문 없는 500을 내보내고, 호출부는 그걸 "성공했는데 데이터가 없음"으로
   * 오해한다. 여기서 잡아 정상적인 오류 응답으로 바꾼다.
   */
  let body;
  try {
    body = req.bodyJson || {};
  } catch {
    error('mail: 본문이 비었거나 JSON이 아님');
    return fail('INVALID_INPUT', '요청을 읽지 못했습니다.', 400);
  }

  // ★신뢰된 uid는 서명 토큰에서만 나온다. widdy-chat과 달리 익명 강등이 없다.
  const uid = resolveUserId(body);
  const action = String(body.action || '(없음)');

  // 실행 로그. 어떤 요청이 들어왔는지 남겨야 "성공처럼 보이는데 저장이 안 됨" 같은 상황을
  // 추적할 수 있다. 토큰·앱 비밀번호는 절대 찍지 않는다.
  log(`action=${action} uid=${uid || '(미인증)'} hasSecret=${Boolean(body.payload?.secret)} key=${resolveKey(req).kind} endpoint=${process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT}`);

  if (!uid) return fail('UNAUTHORIZED', '로그인이 필요합니다. 다시 로그인해 주세요.', 401);

  const payload = body.payload || {};
  // 앱 비밀번호는 payload에서 분리해 둔다. 로그·오류 메시지에 payload를 통째로 찍는 실수를
  // 하더라도 비밀번호가 같이 나가지 않게 하려는 것이다.
  const secret = payload.secret ? String(payload.secret) : null;

  try {
    const dbs = databases(req);

    switch (action) {
      case 'listAccounts':
        return res.json({ data: await listAccounts(dbs, DB, uid) });

      case 'createAccount':
        return res.json({ data: await createAccount(dbs, DB, uid, payload.draft, secret, process.env, log) });

      case 'updateAccount':
        return res.json({
          data: await updateAccount(dbs, DB, uid, String(payload.id || ''), payload.draft, secret, process.env),
        });

      case 'deleteAccount':
        return res.json({ data: await deleteAccount(dbs, DB, uid, String(payload.id || '')) });

      case 'testConnection':
        return res.json({
          data: await testConnection(dbs, DB, uid, payload.draft, secret, payload.id ? String(payload.id) : null, process.env),
        });

      default:
        return fail('UNKNOWN_ACTION', `알 수 없는 요청입니다: ${action}`, 400);
    }
  } catch (e) {
    if (e instanceof MailFnError) return fail(e.code, e.message, e.status);
    // 원문 메시지에는 호스트·인증 정보가 섞일 수 있어 로그에만 남긴다.
    error(`mail(${action}): ${e?.message || e}`);
    return fail('INTERNAL', '메일 서버 처리 중 오류가 발생했습니다.', 500);
  }
};
