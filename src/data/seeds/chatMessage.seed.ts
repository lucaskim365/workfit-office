import { z } from 'zod';
import type { chatMessageSchema } from '@/domain/chatMessage/schema';

/**
 * 채팅 메시지 시드 — 방별 대화 흐름(시연용).
 * readBy 는 "나"(U001 김승기) 관점의 미읽음을 재현: RM-0001 3건·RM-0002 1건 미읽음, 나머지 0.
 * ([[메신저_개발_계획서.md]] Phase 0)
 *
 * 입력 타입(z.input)으로 선언 — attachment 등 기본값 필드는 생략 가능(repo parse 시 채움).
 */
export const CHAT_MESSAGE_SEED: z.input<typeof chatMessageSchema>[] = [
  // ── RM-0001 생산1팀 단톡방 (마지막 3건 U001 미읽음) ──
  { id: 'RM-0001-M001', roomId: 'RM-0001', senderId: 'U002', senderName: '문성민', text: '오늘 3라인 계획 대비 진행 어떤가요?', type: 'text', at: '2026-07-06T08:10:00', readBy: ['U001', 'U002', 'U008'] },
  { id: 'RM-0001-M002', roomId: 'RM-0001', senderId: 'U001', senderName: '김승기', text: '네 순조롭습니다. 오전 목표 달성했어요', type: 'text', at: '2026-07-06T08:15:00', readBy: ['U001', 'U002', 'U008'] },
  { id: 'RM-0001-M003', roomId: 'RM-0001', senderId: 'U008', senderName: '박민준', text: '야간 설비 예열 완료했습니다', type: 'text', at: '2026-07-06T13:50:00', readBy: ['U002', 'U008'] },
  { id: 'RM-0001-M004', roomId: 'RM-0001', senderId: 'U002', senderName: '문성민', text: '확인했습니다. 수고하셨어요', type: 'text', at: '2026-07-06T14:10:00', readBy: ['U002', 'U008'] },
  { id: 'RM-0001-M005', roomId: 'RM-0001', senderId: 'U008', senderName: '박민준', text: '교대 인수인계 완료했습니다', type: 'text', at: '2026-07-06T14:21:00', readBy: ['U002', 'U008'] },

  // ── RM-0002 안중근 (설비보전) 1:1 (마지막 1건 미읽음) ──
  { id: 'RM-0002-M001', roomId: 'RM-0002', senderId: 'U001', senderName: '김승기', text: 'CMP02 점검 좀 부탁드려요', type: 'text', at: '2026-07-06T11:00:00', readBy: ['U001', 'U006'] },
  { id: 'RM-0002-M002', roomId: 'RM-0002', senderId: 'U006', senderName: '안중근', text: '지금 확인 들어갑니다', type: 'text', at: '2026-07-06T11:05:00', readBy: ['U001', 'U006'] },
  { id: 'RM-0002-M003', roomId: 'RM-0002', senderId: 'U006', senderName: '안중근', text: 'CMP02 점검 끝났어요', type: 'text', at: '2026-07-06T14:05:00', readBy: ['U006'] },

  // ── RM-0003 품질보증팀 (모두 읽음) ──
  { id: 'RM-0003-M001', roomId: 'RM-0003', senderId: 'U003', senderName: '이서연', text: '어제 로트 검사 결과 공유합니다', type: 'text', at: '2026-07-06T09:30:00', readBy: ['U001', 'U003', 'U007', 'U011'] },
  { id: 'RM-0003-M002', roomId: 'RM-0003', senderId: 'U011', senderName: '배예린', text: '확인했습니다 👍', type: 'text', at: '2026-07-06T09:35:00', readBy: ['U001', 'U003', 'U007', 'U011'] },
  { id: 'RM-0003-M003', roomId: 'RM-0003', senderId: 'U007', senderName: '윤채원', text: 'SPC 룰 위반 건 확인 부탁드려요', type: 'text', at: '2026-07-06T13:48:00', readBy: ['U001', 'U003', 'U007', 'U011'] },

  // ── RM-0004 임건우 (현장관리) 1:1 (모두 읽음) ──
  { id: 'RM-0004-M001', roomId: 'RM-0004', senderId: 'U001', senderName: '김승기', text: '현장 정리 감사합니다', type: 'text', at: '2026-07-06T13:25:00', readBy: ['U001', 'U005'] },
  { id: 'RM-0004-M002', roomId: 'RM-0004', senderId: 'U005', senderName: '임건우', text: '👍', type: 'text', at: '2026-07-06T13:30:00', readBy: ['U001', 'U005'] },

  // ── RM-0005 공지방 · MES 운영 (notice, 시스템+공지) ──
  { id: 'RM-0005-M001', roomId: 'RM-0005', senderId: '', senderName: '', text: '운영 공지가 등록되는 공지방입니다.', type: 'system', at: '2026-06-20T09:00:00', readBy: ['U001'] },
  { id: 'RM-0005-M002', roomId: 'RM-0005', senderId: 'U001', senderName: '김승기', text: '[공지] MES v5.2 배포 안내', type: 'text', at: '2026-07-06T11:02:00', readBy: ['U001'] },

  // ── RM-0006 신유진 (생산2팀) 1:1 (모두 읽음) ──
  { id: 'RM-0006-M001', roomId: 'RM-0006', senderId: 'U009', senderName: '신유진', text: '자재 입고 언제 되나요?', type: 'text', at: '2026-07-05T17:40:00', readBy: ['U001', 'U009'] },
];
