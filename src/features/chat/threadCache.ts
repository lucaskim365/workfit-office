import type { ChatMessage } from '@/domain/chatMessage/schema';
import { compareChatMessages } from '@/domain/chatMessage/order';

/**
 * 실시간 신호로 받은 메시지 변경을 화면의 방 메시지 목록에 바로 반영한다 — 방 전체를 다시 받지 않는다.
 * (chatRealtime.ts 가 쓴다. 순수 함수라 따로 시험한다)
 */
export type LiveChange = { roomId: string; message: ChatMessage } | { roomId: string; removedId: string };

/** 보내는 중에 화면에 먼저 붙여 둔 내 메시지(useSendMessage) — 저장된 진짜 메시지가 오면 빠진다. */
const isOptimistic = (m: ChatMessage) => m.id.includes('-optimistic-');

export function applyLiveChange(list: ChatMessage[], change: LiveChange): ChatMessage[] {
  if ('removedId' in change) return list.filter((m) => m.id !== change.removedId);
  const next = change.message;
  const at = list.findIndex((m) => m.id === next.id);
  if (at >= 0) return list.map((m, i) => (i === at ? next : m));
  // 먼저 붙여 둔 것 중 같은 사람·같은 글의 가장 앞 하나만 뺀다 — 같은 말을 빠르게 두 번 보내도 하나로 줄지 않게
  const pendingAt = list.findIndex((m) => isOptimistic(m) && m.senderId === next.senderId && m.text === next.text);
  const rest = pendingAt >= 0 ? list.filter((_, i) => i !== pendingAt) : list;
  // 새 메시지는 거의 항상 맨 끝 — 그 자리에 끼워 넣고, 아니면 순서대로 찾는다
  let i = rest.length;
  while (i > 0 && compareChatMessages(rest[i - 1], next) > 0) i--;
  return [...rest.slice(0, i), next, ...rest.slice(i)];
}

/** 시각(ms)이 붙은 변경 기록 */
export interface TimedChange {
  at: number;
  change: LiveChange;
}

/**
 * 서버에서 방 메시지를 받는 동안 들어온 변경을 받은 목록에 다시 얹는다.
 * 받기 시작한 뒤의 변경은 받은 목록에 없을 수 있어서, 이게 없으면 받기가 끝나는 순간 방금 붙인 메시지가 사라진다.
 */
export function replayChanges(list: ChatMessage[], log: readonly TimedChange[], roomId: string, since: number): ChatMessage[] {
  let out = list;
  for (const e of log) if (e.at >= since && e.change.roomId === roomId) out = applyLiveChange(out, e.change);
  return out;
}
