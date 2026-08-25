/**
 * 발신 기록 — 보낸메일함에서 "우리 팀 누가 보냈나"를 잇는다.
 *
 * 쓰는 쪽(`send.js`)과 읽는 쪽(`mailbox.js`)이 **같은 키 계산**을 써야 조인이 맞는다.
 * 두 파일에 각자 두면 한쪽만 고쳐졌을 때 조인이 조용히 안 맞고, 그러면 발신자 이름이
 * 그냥 안 보일 뿐이라 한참 모른다. 그래서 여기 한 곳에 둔다.
 */
import { createHash } from 'node:crypto';

export const SENT_BY_COLLECTION = 'mailSentBy';

/**
 * `Message-ID` → 인덱스 키(sha256 hex 64자).
 *
 * Message-ID를 그대로 인덱스에 걸 수 없다. 길이가 들쭉날쭉해 넉넉히 잡으면 인덱스 키
 * 길이 상한에 걸리고, 짧게 자르면 잘린 뒤가 같은 메일끼리 뭉친다. 길이가 고정된 해시를
 * 키로 쓰고 원본은 따로 보관한다.
 *
 * 꺾쇠는 벗긴다 — 발송 라이브러리와 IMAP 서버가 `<...>`를 붙이는 방식이 서로 다르다.
 */
export function messageIdKey(messageId) {
  const normalized = String(messageId ?? '').trim().replace(/^<|>$/g, '');
  if (normalized === '') return '';
  return createHash('sha256').update(normalized).digest('hex');
}
