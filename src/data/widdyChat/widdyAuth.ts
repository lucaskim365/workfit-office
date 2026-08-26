import { Functions } from 'appwrite';
import { client } from '@/shared/lib/appwrite';

/**
 * Widdy 인증 토큰 — uid 하드닝용 '위조 불가' 서명 토큰의 클라이언트 보관/발급.
 * ([[Widdy_RAG_연계_개발_계획서.md]] Phase 5 하드닝 / [[sign-api-token-client-exposed]])
 *
 * Flow: On successful login (when password is in hand), call the widdy-login function,
 *   re-verify credentials server-side, and obtain an HMAC signature token stored in localStorage.
 *   When querying Widdy, pass this token to the gateway, which verifies the signature
 *   to derive the "trusted uid" (the client cannot forge the uid).
 *
 * If the token is missing (issuance failed/not set) or expired, Widdy degrades to anonymous (public docs + general questions).
 * best-effort: Issuance failure does not block login itself.
 */

const TOKEN_KEY = 'mes.widdy.token';
const LOGIN_FN = (import.meta.env.VITE_WIDDY_LOGIN_FUNCTION_ID as string | undefined) || 'widdy-login';

/** Stored Widdy signature token (null if none). */
export function getWiddyToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Revoke token (logout). */
export function clearWiddyToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Mint Widdy signature token with login credentials and store it.
 * Skip silently if Appwrite is not configured (no client) -> Widdy anonymous operation.
 * Does not throw an exception on failure (protects login flow).
 */
export async function mintWiddyToken(loginId: string, password: string): Promise<void> {
  if (!client) return; // Appwrite not configured -> anonymous degradation
  try {
    const functions = new Functions(client);
    const exec = await functions.createExecution(LOGIN_FN, JSON.stringify({ loginId, password }), false);
    const data = JSON.parse(exec.responseBody) as { token?: string };
    if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
    else clearWiddyToken();
  } catch {
    clearWiddyToken(); // issuance failed -> anonymous
  }
}
