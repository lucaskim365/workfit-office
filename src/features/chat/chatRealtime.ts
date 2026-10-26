import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { client as appwriteClient, APPWRITE_DATABASE_ID } from '@/shared/lib/appwrite';
import { dbDriver } from '@/shared/lib/dbDriver';

/**
 * 메신저 실시간 반영 — 메시지·방이 바뀌면 서버(Appwrite Realtime)가 바로 알려 주고, 바뀐 방만 다시 받는다.
 * 새 메시지가 곧바로 뜨고, 상대가 읽으면 '1'이 곧바로 사라진다. 폴링(CHAT_POLL_MS)은 연결이 끊겼을 때의 대비용.
 *
 * 메신저 화면 여러 곳이 동시에 써도 구독은 하나만 연다(참조 수로 관리).
 * 읽음 처리처럼 수정이 몰려 오면 짧게 모아 한 번만 다시 받는다.
 */

// useChatRooms·useChatThread 와 같은 키 — 순환 import 를 피하려고 값을 그대로 둔다
const ROOMS_KEY = 'chatRooms';
const UNREAD_KEY = 'chatUnread';
const THREAD_KEY = 'chatThread';
const BATCH_MS = 150;

let refs = 0;
let unsubscribe: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const pending = new Set<string>();

function flush(qc: QueryClient) {
  timer = null;
  for (const key of pending) {
    if (key === ROOMS_KEY || key === UNREAD_KEY) qc.invalidateQueries({ queryKey: [key] });
    else qc.invalidateQueries({ queryKey: [THREAD_KEY, key] });
  }
  pending.clear();
}

function onEvent(qc: QueryClient, response: { events?: string[]; payload?: unknown }) {
  const events = response.events ?? [];
  const payload = (response.payload ?? {}) as { roomId?: unknown };
  if (events.some((e) => e.includes('.chatMessages.'))) {
    if (typeof payload.roomId === 'string') pending.add(payload.roomId);
    pending.add(UNREAD_KEY);
  }
  if (events.some((e) => e.includes('.chatRooms.'))) pending.add(ROOMS_KEY);
  if (pending.size > 0 && !timer) timer = setTimeout(() => flush(qc), BATCH_MS);
}

function retain(qc: QueryClient): () => void {
  if (dbDriver !== 'appwrite' || !appwriteClient) return () => {};
  refs += 1;
  if (!unsubscribe) {
    const db = APPWRITE_DATABASE_ID;
    unsubscribe = appwriteClient.subscribe(
      [
        `databases.${db}.collections.chatMessages.documents`,
        `databases.${db}.collections.chatRooms.documents`,
        `databases.${db}.tables.chatMessages.rows`,
        `databases.${db}.tables.chatRooms.rows`,
      ],
      (response) => onEvent(qc, response),
    );
  }
  return () => {
    refs -= 1;
    if (refs > 0) return;
    unsubscribe?.();
    unsubscribe = null;
    if (timer) clearTimeout(timer);
    timer = null;
    pending.clear();
  };
}

/** 메신저 데이터 훅 안에서 부른다 — 화면이 떠 있는 동안만 실시간 구독을 유지한다. */
export function useChatRealtime(): void {
  const qc = useQueryClient();
  useEffect(() => retain(qc), [qc]);
}
