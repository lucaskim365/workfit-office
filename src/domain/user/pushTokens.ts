/**
 * 기기별 푸시 토큰 목록 규칙 (users.fcmTokens).
 * 한 사람이 PC·휴대폰 등 여러 기기에서 알림을 받는다. 예전 단일 칸(fcmToken)도 함께 읽는다.
 */

/** 한 사람이 가질 수 있는 기기 토큰 수. 넘치면 가장 오래된 것부터 뺀다. */
export const MAX_PUSH_TOKENS = 10;

/** 이 사람에게 알림을 보낼 모든 토큰 — 목록 + 예전 단일 칸, 중복·빈 값 제외 */
export function allPushTokens(user: { fcmTokens?: string[] | null; fcmToken?: string | null }): string[] {
  return [...new Set([...(user.fcmTokens ?? []), user.fcmToken ?? ''].filter(Boolean))];
}

/** 이 기기 토큰을 맨 앞(가장 최근)에 넣은 목록. 예전 단일 칸 토큰도 목록으로 옮긴다. */
export function withPushToken(user: { fcmTokens?: string[] | null; fcmToken?: string | null }, token: string): string[] {
  return [token, ...allPushTokens(user).filter((t) => t !== token)].slice(0, MAX_PUSH_TOKENS);
}

/** 토큰 하나를 뺀 목록과 예전 단일 칸 값 */
export function withoutPushToken(
  user: { fcmTokens?: string[] | null; fcmToken?: string | null },
  token: string,
): { fcmTokens: string[]; fcmToken: string } {
  return {
    fcmTokens: (user.fcmTokens ?? []).filter((t) => t && t !== token),
    fcmToken: user.fcmToken === token ? '' : (user.fcmToken ?? ''),
  };
}

/** 이 사람이 이 토큰을 들고 있는가 */
export function hasPushToken(user: { fcmTokens?: string[] | null; fcmToken?: string | null }, token: string): boolean {
  return Boolean(token) && allPushTokens(user).includes(token);
}
