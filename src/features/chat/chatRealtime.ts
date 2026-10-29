import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Realtime, type RealtimeResponseEvent } from 'appwrite';
import { client as appwriteClient, APPWRITE_DATABASE_ID } from '@/shared/lib/appwrite';
import { dbDriver } from '@/shared/lib/dbDriver';
import { chatMessageRepo } from '@/data/chatMessage/chatMessage.repo';
import type { ChatMessage } from '@/domain/chatMessage/schema';
import { applyLiveChange, replayChanges, type LiveChange, type TimedChange } from './threadCache';
import { fetchThreadWindow, threadWindowOf } from './threadWindow';

/**
 * 메신저 데이터 맞추기 — 화면의 메신저 데이터를 언제 서버와 맞추는지는 이 파일 한 곳에서 정한다.
 *
 * 1. 실시간 신호(Appwrite Realtime): 메시지가 생기거나 바뀌면 신호에 실린 내용으로 열린 방 목록을 바로 고친다.
 *    방 전체를 다시 받지 않는다. 방 목록·안읽음 수는 가벼워서 다시 받는다(짧게 모아 한 번).
 *    방 메시지는 받아 둔 구간(threadWindow — 최근 100건부터, 위로 올리면 더)만 다룬다.
 * 2. 한꺼번에 맞추기(resync): 실시간 연결이 붙거나 끊길 때, 10초 넘게 다른 창에 있다가 돌아올 때 — 그 사이 놓친 신호를 메우려고 화면에 떠 있는 것을 다시 받는다.
 * 3. 주기 조회: 실시간이 연결돼 있으면 1분, 끊겨 있으면 4초. 메신저 화면이 보일 때만 돈다.
 *
 * 다시 받을 때는 받는 중인 요청을 취소하지 않는다(취소하면 신호가 이어질 때 끝내 받지 못한다).
 * 받는 동안 들어온 변경은 받은 뒤 다시 얹는다(fetchThread).
 *
 * 메신저 화면 여러 곳이 동시에 써도 연결은 하나만 연다(참조 수로 관리).
 */

// useChatRooms·useChatThread 와 같은 키 — 순환 import 를 피하려고 값을 그대로 둔다
const ROOMS_KEY = 'chatRooms';
const UNREAD_KEY = 'chatUnread';
const THREAD_KEY = 'chatThread';

/** 실시간이 끊겼을 때의 주기 조회 간격 */
export const CHAT_POLL_FALLBACK_MS = 4000;
const POLL_CONNECTED_MS = 60_000;
const BATCH_MS = 150;
const RESYNC_AFTER_HIDDEN_MS = 10_000;
/** 연결이 붙은 뒤 구독 요청이 서버에 닿을 시간을 두고 맞춘다 — 그 틈에 온 메시지를 놓치지 않게 */
const RESYNC_AFTER_OPEN_MS = 1000;
const LIVE_KEEP_MS = 60_000;

let refs = 0;
let realtime: Realtime | null = null;
let connected = false;
let qcRef: QueryClient | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let hiddenAt = 0;
const pending = new Set<string>();
/** 최근 메시지 변경 — 받는 중이던 방 메시지에 다시 얹는 데 쓴다 */
const recent: TimedChange[] = [];

/** 주기 조회 간격 — 실시간이 연결돼 있으면 길게 */
export function chatPollInterval(): number {
  return connected ? POLL_CONNECTED_MS : CHAT_POLL_FALLBACK_MS;
}

/**
 * 방 메시지 받기(받아 둔 구간만 — threadWindow) — 받는 동안 실시간으로 들어온 변경을 받은 목록에 다시 얹는다.
 * cached: 지금 화면의 방 메시지(없으면 처음 받기).
 */
export async function fetchThread(roomId: string, cached: () => ChatMessage[] | undefined): Promise<ChatMessage[]> {
  const since = Date.now();
  const list = await fetchThreadWindow(roomId, cached);
  return replayChanges(list, recent, roomId, since, threadWindowOf(roomId).from);
}

function remember(change: LiveChange) {
  const now = Date.now();
  recent.push({ at: now, change });
  while (recent.length && recent[0].at < now - LIVE_KEEP_MS) recent.shift();
}

function resync(qc: QueryClient) {
  for (const key of [ROOMS_KEY, UNREAD_KEY, THREAD_KEY]) qc.invalidateQueries({ queryKey: [key] }, { cancelRefetch: false });
}

function flush(qc: QueryClient) {
  timer = null;
  for (const key of pending) {
    const queryKey = key === ROOMS_KEY || key === UNREAD_KEY ? [key] : [THREAD_KEY, key];
    qc.invalidateQueries({ queryKey }, { cancelRefetch: false });
  }
  pending.clear();
}

function onEvent(qc: QueryClient, response: RealtimeResponseEvent<Record<string, unknown>>) {
  const events = response.events ?? [];
  const payload = response.payload ?? {};
  if (events.some((e) => e.includes('.chatMessages.'))) {
    const roomId = typeof payload.roomId === 'string' ? payload.roomId : null;
    if (roomId) {
      const removed = events.some((e) => e.endsWith('.delete'));
      const message = removed ? null : chatMessageRepo.fromRealtime(payload);
      const change: LiveChange | null = removed ? { roomId, removedId: String(payload.$id) } : message ? { roomId, message } : null;
      if (change) {
        remember(change);
        qc.setQueryData<ChatMessage[]>([THREAD_KEY, roomId], (cur) => cur && applyLiveChange(cur, change, threadWindowOf(roomId).from));
      } else {
        pending.add(roomId); // 내용을 읽을 수 없으면 그 방만 다시 받는다
      }
    }
    pending.add(UNREAD_KEY);
  }
  if (events.some((e) => e.includes('.chatRooms.'))) pending.add(ROOMS_KEY);
  if (pending.size > 0 && !timer) timer = setTimeout(() => flush(qc), BATCH_MS);
}

const onVisibility = () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt >= RESYNC_AFTER_HIDDEN_MS && qcRef) resync(qcRef);
};

function start(qc: QueryClient) {
  const db = APPWRITE_DATABASE_ID;
  // 메신저 전용 연결 — 연결이 붙고 끊기는 때를 알아야 해서 따로 연다
  const rt = new Realtime(appwriteClient!);
  realtime = rt;
  qcRef = qc;
  rt.onOpen(() => {
    if (realtime !== rt) return;
    connected = true;
    setTimeout(() => realtime === rt && resync(qc), RESYNC_AFTER_OPEN_MS);
  });
  rt.onClose(() => {
    if (realtime !== rt) return;
    connected = false;
    resync(qc); // 주기 조회를 4초로 되돌리는 계기이기도 하다
  });
  rt.subscribe<Record<string, unknown>>(
    [
      `databases.${db}.collections.chatMessages.documents`,
      `databases.${db}.collections.chatRooms.documents`,
      `databases.${db}.tables.chatMessages.rows`,
      `databases.${db}.tables.chatRooms.rows`,
    ],
    (response) => onEvent(qc, response),
  ).catch((e) => console.warn('[chat] 실시간 연결 실패 — 4초 조회로 받습니다', e));
  document.addEventListener('visibilitychange', onVisibility);
}

function stop() {
  const rt = realtime;
  realtime = null;
  connected = false;
  qcRef = null;
  void rt?.disconnect();
  document.removeEventListener('visibilitychange', onVisibility);
  if (timer) clearTimeout(timer);
  timer = null;
  pending.clear();
  recent.length = 0;
}

function retain(qc: QueryClient): () => void {
  if (dbDriver !== 'appwrite' || !appwriteClient) return () => {};
  refs += 1;
  if (!realtime) start(qc);
  return () => {
    refs -= 1;
    if (refs === 0) stop();
  };
}

/** 메신저 데이터 훅 안에서 부른다 — 화면이 떠 있는 동안만 연결을 유지한다. */
export function useChatRealtime(): void {
  const qc = useQueryClient();
  useEffect(() => retain(qc), [qc]);
}
