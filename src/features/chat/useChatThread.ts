import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatMessageRepo } from '@/data/chatMessage/chatMessage.repo';
import { chatRoomRepo } from '@/data/chatRoom/chatRoom.repo';
import type { ChatMessage } from '@/domain/chatMessage/schema';
import { CHAT_ROOMS_KEY, CHAT_UNREAD_KEY, CHAT_POLL_MS } from './useChatRooms';

/**
 * 채팅방 대화(스레드) 훅 — 메시지 조회 + 낙관적 전송 + 읽음 처리.
 * ([[data-layer-pattern]] 정본 패턴 / [[메신저_개발_계획서.md]] Phase 1)
 */
export const CHAT_THREAD_KEY = 'chatThread';

/**
 * 시드와 동일한 로컬 나이브 타임스탬프 'YYYY-MM-DDTHH:mm:ss'.
 * ⚠ new Date().toISOString() 은 UTC(KST-9h)로 찍혀, 로컬 시각으로 저장된
 *    시드 메시지보다 앞서 정렬돼 대화 순서가 뒤섞인다. 반드시 로컬 포맷으로.
 */
function localStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 방의 메시지(시간 오름차순). */
export function useChatThread(roomId?: string) {
  return useQuery({
    queryKey: [CHAT_THREAD_KEY, roomId ?? null],
    queryFn: () => chatMessageRepo.listByRoom(roomId!),
    enabled: !!roomId,
    refetchInterval: CHAT_POLL_MS,
  });
}

interface SendVars {
  text: string;
  senderId: string;
  senderName: string;
}

/** 메시지 전송(낙관적) — 캐시에 즉시 추가 → 실패 시 롤백. 성공 시 방 목록 lastMessage 갱신. */
export function useSendMessage(roomId: string) {
  const qc = useQueryClient();
  const key = [CHAT_THREAD_KEY, roomId];

  return useMutation({
    mutationFn: async ({ text, senderId, senderName }: SendVars) => {
      const at = localStamp();
      const message: ChatMessage = {
        id: `${roomId}-${Date.now()}`,
        roomId,
        senderId,
        senderName,
        text,
        type: 'text',
        at,
        readBy: [senderId],
      };
      await chatMessageRepo.append(message);
      await chatRoomRepo.updateLastMessage(roomId, { text, at, senderId });
      return message;
    },
    onMutate: async ({ text, senderId, senderName }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ChatMessage[]>(key);
      const optimistic: ChatMessage = {
        id: `${roomId}-optimistic-${Date.now()}`,
        roomId,
        senderId,
        senderName,
        text,
        type: 'text',
        at: localStamp(),
        readBy: [senderId],
      };
      qc.setQueryData<ChatMessage[]>(key, [...(prev ?? []), optimistic]);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: [CHAT_ROOMS_KEY] });
      qc.invalidateQueries({ queryKey: [CHAT_UNREAD_KEY] });
    },
  });
}

/** 방 진입 시 읽음 처리 — 미읽음 배지 클리어. */
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, userId }: { roomId: string; userId: string }) =>
      chatMessageRepo.markRead(roomId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CHAT_UNREAD_KEY] });
      qc.invalidateQueries({ queryKey: [CHAT_THREAD_KEY] });
    },
  });
}
