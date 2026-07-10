import { z } from 'zod';
import type { chatRoomSchema } from '@/domain/chatRoom/schema';

/**
 * 채팅방 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스.
 * 기존 QuickDock MessengerPanel 하드코딩 6방을 실 users(U0xx) 참여자로 이관.
 * "나"(데모 기본 로그인) = U001 김승기 기준. 1:1 방 이름 = 상대 이름.
 * ([[메신저_개발_계획서.md]] Phase 0)
 *
 * 입력 타입(z.input)으로 선언 — deletedAt/deletedBy 등 기본값 필드는 생략 가능(repo parse 시 채움).
 */
export const CHAT_ROOM_SEED: z.input<typeof chatRoomSchema>[] = [
  {
    id: 'RM-0002',
    name: '안중근 (설비보전)',
    type: 'direct',
    members: ['U001', 'U006'],
    color: '#3a6ee0',
    lastMessage: { text: 'CMP02 점검 끝났어요', at: '2026-07-06T14:05:00', senderId: 'U006' },
    createdAt: '2026-07-01T10:30:00',
  },
  {
    id: 'RM-0005',
    name: '공지방 · MES 운영',
    type: 'notice',
    members: ['U001', 'U002', 'U003', 'U006', 'U007', 'U008', 'U009', 'U010', 'U011'],
    color: '#1f2f55',
    lastMessage: { text: '[공지] MES v5.2 배포 안내', at: '2026-07-06T11:02:00', senderId: 'U001' },
    createdAt: '2026-06-20T09:00:00',
  },
  {
    id: 'RM-0006',
    name: '신유진 (생산2팀)',
    type: 'direct',
    members: ['U001', 'U009'],
    color: '#8b5cf6',
    lastMessage: { text: '자재 입고 언제 되나요?', at: '2026-07-05T17:40:00', senderId: 'U009' },
    createdAt: '2026-07-03T14:00:00',
  },
];
