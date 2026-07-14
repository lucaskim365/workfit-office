import { z } from 'zod';
import type { chatRoomSchema } from '@/domain/chatRoom/schema';

/**
 * 채팅방 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스.
 * 기존 QuickDock MessengerPanel 하드코딩 6방을 실 users(U0xx) 참여자로 이관.
 * "나"(데모 기본 로그인) = U001 박영미 기준. 1:1 방 이름 = 상대 이름.
 * ([[메신저_개발_계획서.md]] Phase 0)
 *
 * 입력 타입(z.input)으로 선언 — deletedAt/deletedBy 등 기본값 필드는 생략 가능(repo parse 시 채움).
 */
export const CHAT_ROOM_SEED: z.input<typeof chatRoomSchema>[] = [];
