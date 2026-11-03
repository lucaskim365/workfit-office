import type { QueryClient } from '@tanstack/react-query';
import { chatMessageRepo } from '@/data/chatMessage/chatMessage.repo';
import type { ChatMessage } from '@/domain/chatMessage/schema';
import { mergeMessages } from './threadCache';

/**
 * 방 메시지 나눠 받기 — 처음엔 최근 100건, 위로 올리면 100건씩 더.
 *
 * 방마다 "어디까지 받았는지"(받아 둔 가장 오래된 메시지 시각 from)를 기억한다. 다시 받을 때(실시간 보정·주기 조회)는
 * from 이후만 받으므로, 위로 올려 더 받아 둔 메시지가 다시 받기 때문에 사라지지 않는다.
 * 화면은 계속 방 메시지 배열 하나만 본다(캐시 키 [chatThread, roomId]).
 */
export const THREAD_PAGE_SIZE = 100;
/** 검색 결과·답장 원문으로 이동할 때 그 위로 더 받는 수 — 찾은 메시지가 맨 첫 칸이 되면 가운데로 못 오고 위에 붙어 가려진다 */
const CONTEXT_ABOVE = 20;

// useChatThread 와 같은 키 — 순환 import 를 피하려고 값을 그대로 둔다
const THREAD_KEY = 'chatThread';

export interface ThreadWindow {
  /** 받아 둔 가장 오래된 메시지 시각 — 아직 안 받았거나 빈 방이면 null */
  from: string | null;
  /** 이보다 오래된 메시지가 더 있을 수 있는지 */
  hasOlder: boolean;
  /** 옛 메시지를 받는 중인지 */
  loading: boolean;
}

const EMPTY: ThreadWindow = { from: null, hasOlder: false, loading: false };
const windows = new Map<string, ThreadWindow>();
const listeners = new Set<() => void>();

export function threadWindowOf(roomId: string): ThreadWindow {
  return windows.get(roomId) ?? EMPTY;
}

function setWindow(roomId: string, patch: Partial<ThreadWindow>) {
  windows.set(roomId, { ...threadWindowOf(roomId), ...patch });
  for (const l of listeners) l();
}

/** 옛 메시지 받기 진행 수 — 위로 올려 받기와 검색·답장 이동이 겹쳐도 둘 다 끝나야 loading 이 꺼진다 */
const inflight = new Map<string, number>();
async function track<T>(roomId: string, job: () => Promise<T>): Promise<T> {
  inflight.set(roomId, (inflight.get(roomId) ?? 0) + 1);
  setWindow(roomId, { loading: true });
  try {
    return await job();
  } finally {
    const left = (inflight.get(roomId) ?? 1) - 1;
    inflight.set(roomId, left);
    if (left === 0) setWindow(roomId, { loading: false });
  }
}

/** 받아 둔 구간을 at 까지 넓힌다 — 이미 더 넓으면 그대로(받기가 겹쳐도 좁아지지 않게) */
function extendTo(roomId: string, at: string, hasOlder: boolean) {
  const from = threadWindowOf(roomId).from;
  if (!from || at < from) setWindow(roomId, { from: at, hasOlder });
}

/** useSyncExternalStore 용 구독 */
export function subscribeThreadWindows(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 방 메시지 받기. 처음(또는 캐시가 비워진 뒤)에는 최근 한 쪽, 그 뒤로는 받아 둔 구간(from 이후)만.
 * cached: 지금 화면의 방 메시지 — 받는 동안 위쪽을 더 받았으면 그 부분은 화면 것을 그대로 둔다.
 */
export async function fetchThreadWindow(roomId: string, cached: () => ChatMessage[] | undefined): Promise<ChatMessage[]> {
  const from = threadWindowOf(roomId).from;
  if (!from || !cached()) {
    const page = await chatMessageRepo.listPage(roomId, THREAD_PAGE_SIZE);
    setWindow(roomId, { from: page.messages[0]?.at ?? null, hasOlder: page.hasOlder });
    return page.messages;
  }
  const list = await chatMessageRepo.listRange(roomId, from);
  const older = (cached() ?? []).filter((m) => m.at < from);
  return older.length ? [...older, ...list] : list;
}

/** 위로 올렸을 때 — 받아 둔 것보다 오래된 한 쪽을 더 받아 앞에 붙인다. 받을 게 없거나 받는 중이면 그냥 끝난다. */
export async function loadOlderMessages(qc: QueryClient, roomId: string): Promise<void> {
  const w = threadWindowOf(roomId);
  if (!w.from || !w.hasOlder || w.loading) return;
  const before = w.from;
  await track(roomId, async () => {
    const page = await chatMessageRepo.listPage(roomId, THREAD_PAGE_SIZE, before);
    qc.setQueryData<ChatMessage[]>([THREAD_KEY, roomId], (cur) => mergeMessages(cur ?? [], page.messages));
    if (page.messages.length) extendTo(roomId, page.messages[0].at, page.hasOlder);
    else if (threadWindowOf(roomId).from === before) setWindow(roomId, { hasOlder: false });
  });
}

/**
 * 특정 시각까지 거슬러 받기 — 검색 결과·답장 원문이 아직 안 받은 구간에 있을 때. 그 사이를 한 번에 받고,
 * 그 위로도 조금(CONTEXT_ABOVE) 더 받아 찾은 메시지를 화면 가운데로 보낼 수 있게 한다.
 */
export async function loadMessagesSince(qc: QueryClient, roomId: string, at: string): Promise<void> {
  const until = threadWindowOf(roomId).from;
  if (!until || at >= until) return;
  await track(roomId, async () => {
    const [list, above] = await Promise.all([
      chatMessageRepo.listRange(roomId, at, until),
      chatMessageRepo.listPage(roomId, CONTEXT_ABOVE, at),
    ]);
    qc.setQueryData<ChatMessage[]>([THREAD_KEY, roomId], (cur) => mergeMessages(cur ?? [], [...above.messages, ...list]));
    extendTo(roomId, above.messages[0]?.at ?? at, above.hasOlder);
  });
}
