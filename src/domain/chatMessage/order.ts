import type { ChatMessage } from './schema';

/**
 * 방 안 메시지 순서 — 시간 오름차순. 같은 시각(초 단위)에 저장된 묶음은 id 순서로(사진 묶음 순서가 섞이지 않게).
 * 서버에서 받은 목록과 실시간으로 끼워 넣는 메시지가 같은 규칙을 쓴다.
 */
export function compareChatMessages(a: ChatMessage, b: ChatMessage): number {
  return a.at.localeCompare(b.at) || a.id.localeCompare(b.id, undefined, { numeric: true });
}
