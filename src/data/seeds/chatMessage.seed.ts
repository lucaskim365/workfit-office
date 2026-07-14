import { z } from 'zod';
import type { chatMessageSchema } from '@/domain/chatMessage/schema';

/**
 * 채팅 메시지 시드 — 방별 대화 흐름(시연용).
 * readBy 는 "나"(U001) 관점의 미읽음을 재현: RM-0002 1건 미읽음, 나머지 0.
 * ([[메신저_개발_계획서.md]] Phase 0)
 *
 * 입력 타입(z.input)으로 선언 — attachment 등 기본값 필드는 생략 가능(repo parse 시 채움).
 */
export const CHAT_MESSAGE_SEED: z.input<typeof chatMessageSchema>[] = [];
