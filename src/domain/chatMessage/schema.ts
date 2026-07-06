import { z } from 'zod';

/**
 * 채팅 메시지(ChatMessage) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 방(chatRooms) 안의 개별 메시지. ([[메신저_개발_계획서.md]] §5.2)
 *
 * 저장: 코드베이스 정본대로 플랫 top-level 컬렉션 `chatMessages`(roomId 필드로 방 구분).
 *   서브컬렉션 대신 플랫 — 기존 118개 컬렉션·시드러너 균일 매핑과 일치.
 * type: text(일반) / system(입장·초대 안내 등 가운데 캡슐).
 * readBy: 읽은 users.id 배열 → 미읽음은 저장하지 않고 여기서 도출.
 */
export const CHAT_MESSAGE_TYPES = ['text', 'system'] as const;
export type ChatMessageType = (typeof CHAT_MESSAGE_TYPES)[number];

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  /** 보낸 사람 users.id. system 메시지는 빈 문자열. */
  senderId: z.string().default(''),
  senderName: z.string().default(''),
  text: z.string(),
  type: z.enum(CHAT_MESSAGE_TYPES).default('text'),
  /** 전송 시각(ISO). 방 안 정렬 키. */
  at: z.string(),
  readBy: z.array(z.string()).default([]),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
