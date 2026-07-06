import { useQuery } from '@tanstack/react-query';
import { chatRoomRepo } from '@/data/chatRoom/chatRoom.repo';
import { chatMessageRepo } from '@/data/chatMessage/chatMessage.repo';

/**
 * 채팅방 목록 데이터 훅 — 화면이 repository 대신 호출하는 React 바인딩.
 * ([[data-layer-pattern]] 정본 패턴 / [[메신저_개발_계획서.md]] Phase 1)
 */
export const CHAT_ROOMS_KEY = 'chatRooms';
export const CHAT_UNREAD_KEY = 'chatUnread';

/**
 * 준실시간 폴링 주기(ms). 메신저 패널이 열려 있을 때만 쿼리가 마운트되므로
 * 유휴 비용은 없다. 탭 비활성 시 refetchInterval 은 자동 일시정지(기본값).
 * ([[메신저_개발_계획서.md]] Phase 2 — Option A 폴링)
 */
export const CHAT_POLL_MS = 4000;

/** 내가 참여한 방 목록(최근 메시지순). */
export function useChatRooms(userId?: string) {
  return useQuery({
    queryKey: [CHAT_ROOMS_KEY, userId ?? null],
    queryFn: () => chatRoomRepo.list(userId),
    enabled: !!userId,
    refetchInterval: CHAT_POLL_MS,
  });
}

/** 방별 미읽음 수 맵(도출). */
export function useUnreadCounts(userId?: string) {
  return useQuery({
    queryKey: [CHAT_UNREAD_KEY, userId ?? null],
    queryFn: () => chatMessageRepo.unreadByRoom(userId!),
    enabled: !!userId,
    refetchInterval: CHAT_POLL_MS,
  });
}
