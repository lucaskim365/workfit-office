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
  /**
   * 소프트 삭제(아카이브) 표시. 빈 문자열 = 활성. 값이 있으면 삭제 시각(관리자 삭제).
   * ⚠ 삭제해도 chatMessages(대화 내용)는 보존 — 어드민 감사/조회용. 목록에서만 숨김.
   */
  deletedAt: z.string().default(''),
  /** 삭제를 실행한 관리자 users.id(감사 추적용). */
  deletedBy: z.string().default(''),
});

export type ChatRoom = z.infer<typeof chatRoomSchema>;
