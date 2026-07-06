import { z } from 'zod';

/**
 * 채팅방(ChatRoom) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 사내 메신저(퀵 도크)의 대화방 마스터. ([[메신저_개발_계획서.md]] §5.1)
 *
 * type: group(그룹) / direct(1:1) / notice(공지·읽기전용).
 *   그룹방 = type:'group' + members.length ≥ 3, 1:1 = 'direct'(정확히 2명).
 * members: 참여자 users.id 배열(FK). 그룹초대 = members 에 append.
 * lastMessage: 목록 표시·정렬용 비정규화(매번 메시지를 훑지 않도록).
 */
export const CHAT_ROOM_TYPES = ['group', 'direct', 'notice'] as const;
export type ChatRoomType = (typeof CHAT_ROOM_TYPES)[number];

/** 방 목록 표시용 마지막 메시지 요약(비정규화). */
export const lastMessageSchema = z.object({
  text: z.string(),
  at: z.string(),
  senderId: z.string(),
});
export type LastMessage = z.infer<typeof lastMessageSchema>;

export const chatRoomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, '방 이름은 필수입니다'),
  type: z.enum(CHAT_ROOM_TYPES),
  members: z.array(z.string()).default([]),
  color: z.string().default('#e6960c'),
  lastMessage: lastMessageSchema.nullable().default(null),
  createdAt: z.string().default(''),
});

export type ChatRoom = z.infer<typeof chatRoomSchema>;
