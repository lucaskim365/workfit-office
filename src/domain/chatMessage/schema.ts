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
export const CHAT_MESSAGE_TYPES = ['text', 'system', 'image', 'file'] as const;
export type ChatMessageType = (typeof CHAT_MESSAGE_TYPES)[number];

/** 첨부 허용 최대 용량(데모: 10MB). storage.rules·업로드 repo·입력 UI 3곳에서 강제. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** 첨부(이미지/파일) 메타. type이 image/file 일 때 채워진다. Storage 업로드 결과. */
export const attachmentSchema = z.object({
  /** Storage download URL(이미지 표시·파일 다운로드). */
  url: z.string(),
  /** 원본 파일명. */
  name: z.string(),
  /** 바이트 크기. */
  size: z.number(),
  /** MIME 타입(image/* 여부로 미리보기 판단). */
  mime: z.string(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  /** 보낸 사람 users.id. system 메시지는 빈 문자열. */
  senderId: z.string().default(''),
  senderName: z.string().default(''),
  text: z.string(),
  type: z.enum(CHAT_MESSAGE_TYPES).default('text'),
  /** image/file 메시지의 첨부 메타. text/system 은 null. */
  attachment: attachmentSchema.nullable().default(null),
  /** 전송 시각(ISO). 방 안 정렬 키. */
  at: z.string(),
  readBy: z.array(z.string()).default([]),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
