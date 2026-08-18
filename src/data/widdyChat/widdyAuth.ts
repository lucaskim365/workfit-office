import { Functions } from 'appwrite';
import { client } from '@/shared/lib/appwrite';

/**
 * Widdy 인증 토큰 — uid 하드닝용 '위조 불가' 서명 토큰의 클라이언트 보관/발급.
 * ([[Widdy_RAG_연계_개발_계획서.md]] Phase 5 하드닝 / [[sign-api-token-client-exposed]])
 *
 * 흐름: 로그인 성공 시(비밀번호가 손에 있을 때) widdy-login 함수를 호출해
 *   서버측에서 자격증명을 재검증하고 HMAC 서명 토큰을 받아 sessionStorage 에 보관한다.
 *   Widdy 질의 시 이 토큰을 게이트웨이로 보내면, 게이트웨이가 서명을 검증해
 *   '신뢰된 uid'를 도출한다(클라이언트는 uid 를 위조하지 못한다).
 *
 * 토큰이 없거나(발급 실패/미설정) 만료되면 Widdy 는 익명(public 문서+일반질문)으로 강등된다.
 * best-effort: 발급 실패가 로그인 자체를 막지 않는다.
 */

const TOKEN_KEY = 'mes.widdy.token';
const LOGIN_FN = (import.meta.env.VITE_WIDDY_LOGIN_FUNCTION_ID as string | undefined) || 'widdy-login';

/** 보관된 Widdy 서명 토큰(없으면 null). */
export function getWiddyToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** 토큰 폐기(로그아웃). */
export function clearWiddyToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

/**
 * 로그인 자격증명으로 Widdy 서명 토큰을 발급받아 보관.
 * Appwrite 미설정 시(client 없음) 조용히 skip → Widdy 익명 동작.
 * 실패해도 예외를 던지지 않는다(로그인 흐름 보호).
 */
export async function mintWiddyToken(loginId: string, password: string): Promise<void> {
  if (!client) return; // Appwrite 미설정 → 익명 강등
  try {
    const functions = new Functions(client);
    const exec = await functions.createExecution(LOGIN_FN, JSON.stringify({ loginId, password }), false);
    const data = JSON.parse(exec.responseBody) as { token?: string };
    if (data.token) sessionStorage.setItem(TOKEN_KEY, data.token);
    else clearWiddyToken();
  } catch {
    clearWiddyToken(); // 발급 실패 → 익명
  }
}
