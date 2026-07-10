import { z } from 'zod';
import type { chatMessageSchema } from '@/domain/chatMessage/schema';

/**
 * 채팅 메시지 시드 — 방별 대화 흐름(시연용).
 * readBy 는 "나"(U001) 관점의 미읽음을 재현: RM-0002 1건 미읽음, 나머지 0.
 * ([[메신저_개발_계획서.md]] Phase 0)
 *
 * 입력 타입(z.input)으로 선언 — attachment 등 기본값 필드는 생략 가능(repo parse 시 채움).
 */
export const CHAT_MESSAGE_SEED: z.input<typeof chatMessageSchema>[] = [
  // ── RM-0002 강윤석 (품질관리팀) 1:1 (마지막 1건 미읽음) ──
  { id: 'RM-0002-M001', roomId: 'RM-0002', senderId: 'U001', senderName: '박영미', text: '수입검사 표준서 개정 건 검토 좀 부탁드려요', type: 'text', at: '2026-07-06T11:00:00', readBy: ['U001', 'U006'] },
  { id: 'RM-0002-M002', roomId: 'RM-0002', senderId: 'U006', senderName: '강윤석', text: '지금 확인 들어갑니다', type: 'text', at: '2026-07-06T11:05:00', readBy: ['U001', 'U006'] },
  { id: 'RM-0002-M003', roomId: 'RM-0002', senderId: 'U006', senderName: '강윤석', text: '검토 끝났습니다. 의견 정리해서 올릴게요', type: 'text', at: '2026-07-06T14:05:00', readBy: ['U006'] },

  // ── RM-0005 공지방 · MES 운영 (notice, 시스템+공지) ──
  { id: 'RM-0005-M001', roomId: 'RM-0005', senderId: '', senderName: '', text: '운영 공지가 등록되는 공지방입니다.', type: 'system', at: '2026-06-20T09:00:00', readBy: ['U001'] },
  { id: 'RM-0005-M002', roomId: 'RM-0005', senderId: 'U001', senderName: '박영미', text: '[공지] WorkFit Intranet v5.2 배포 안내', type: 'text', at: '2026-07-06T11:02:00', readBy: ['U001'] },

  // ── RM-0006 박명규 (사업관리팀) 1:1 (모두 읽음) ──
  { id: 'RM-0006-M001', roomId: 'RM-0006', senderId: 'U009', senderName: '박명규', text: '이번 주 사업계획 리뷰 일정 잡을까요?', type: 'text', at: '2026-07-05T17:40:00', readBy: ['U001', 'U009'] },
];
