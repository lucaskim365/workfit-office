import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatRoomRepo, type CreateRoomInput } from '@/data/chatRoom/chatRoom.repo';
import { chatMessageRepo } from '@/data/chatMessage/chatMessage.repo';
import { nowLocalIso } from '@/shared/lib/datetime';
import { CHAT_THREAD_KEY } from './useChatThread';

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

/** 신규 방 생성(1:1/그룹). 생성된 방을 반환 → 화면이 즉시 그 방을 연다. */
export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoomInput) => chatRoomRepo.create(input),
    // 목록이 새 방을 포함한 뒤 resolve 되도록 refetch 완료까지 await(생성 직후 열기 시 깜빡임 방지).
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [CHAT_ROOMS_KEY] });
    },
  });
}

interface InviteVars {
  roomId: string;
  /** 초대할 users.id */
  userIds: string[];
  inviterName: string;
  inviteeNames: string[];
}

/** 그룹 초대 — 방 members 확장 + "○○님이 △△님을 초대했습니다" 시스템 메시지. */
export function useInviteMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ roomId, userIds, inviterName, inviteeNames }: InviteVars) => {
      await chatRoomRepo.addMembers(roomId, userIds);
      await chatMessageRepo.append({
        id: `${roomId}-sys-${Date.now()}`,
        roomId,
        senderId: '',
        senderName: '',
        text: `${inviterName}님이 ${inviteeNames.join(', ')}님을 초대했습니다`,
        type: 'system',
        at: nowLocalIso(),
        readBy: [],
      });
    },
    onSuccess: (_data, { roomId }) => {
      qc.invalidateQueries({ queryKey: [CHAT_ROOMS_KEY] });
      qc.invalidateQueries({ queryKey: [CHAT_THREAD_KEY, roomId] });
    },
  });
}
