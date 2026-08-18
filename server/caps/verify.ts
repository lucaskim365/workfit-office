import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * CAPS 인제스트 요청 인증 — 계약 §2.
 *
 * 서명 대상은 **파싱 전 원문 바이트** 기준의 `timestamp + "." + rawBody`다. 파싱본을
 * 다시 직렬화하면 바이트가 달라져 정상 요청도 거절된다. 호출부가 raw 문자열을 그대로
 * 넘겨야 하는 이유다.
 */
export const CAPS_TIMESTAMP_SKEW_SEC = 300;

export type CapsVerifyResult = 'ok' | 'missing' | 'stale' | 'mismatch';

export function verifyCapsRequest(
  secret: string,
  timestamp: string | undefined,
  signature: string | undefined,
  rawBody: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): CapsVerifyResult {
  if (!secret || !timestamp || !signature) return 'missing';

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return 'missing';
  // 재전송 방지. 시계가 5분 넘게 어긋난 요청은 서명이 맞아도 받지 않는다.
  if (Math.abs(nowSec - ts) > CAPS_TIMESTAMP_SKEW_SEC) return 'stale';

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(signature.trim().toLowerCase(), 'utf8');
  // timingSafeEqual은 길이가 다르면 던진다. 길이 차이 자체는 비밀이 아니므로 먼저 거른다.
  if (left.length !== right.length) return 'mismatch';
  return timingSafeEqual(left, right) ? 'ok' : 'mismatch';
}

/** 테스트·샘플 전송 스크립트가 에이전트와 같은 방식으로 서명을 만들 때 쓴다. */
export function signCapsRequest(secret: string, timestamp: string, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
}
