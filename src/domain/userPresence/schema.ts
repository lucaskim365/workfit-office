import { z } from 'zod';
import { PERSON_TONES } from '@/shared/theme/statusColors';

/**
 * 사용자 근무/활동 실시간 상태 코드 (6종 프리셋)
 * - ONLINE: 업무중 (온라인)
 * - OFFLINE: 오프라인 (퇴근 또는 미접속)
 * - OUTSIDE: 외근·출장
 * - MEETING: 회의중
 * - FOCUS: 집중근무 (방해금지)
 * - LEAVE: 휴가 (부재중)
 * - AWAY: 자리비움 (창은 열려 있으나 키보드·마우스 입력이 20분 없음)
 */
export const USER_PRESENCE_STATUSES = ['ONLINE', 'OFFLINE', 'OUTSIDE', 'MEETING', 'FOCUS', 'LEAVE', 'AWAY'] as const;
export type UserPresenceStatus = (typeof USER_PRESENCE_STATUSES)[number];

/**
 * 사용자가 프로필에서 직접 고를 수 있는 상태. 외근·출장·회의중·휴가는 전자결재·외근 등록·캘린더로만 정해진다.
 */
export const MANUAL_PRESENCE_STATUSES: readonly UserPresenceStatus[] = ['ONLINE', 'AWAY', 'FOCUS', 'OFFLINE'];

export interface UserPresenceMeta {
  code: UserPresenceStatus;
  label: string;
  dotColor: string; // Tailwind dot / bg
  bgTone: string;
  textColor: string;
  icon: string;
  desc: string;
}

export const USER_PRESENCE_META: Record<UserPresenceStatus, UserPresenceMeta> = {
  ONLINE: {
    code: 'ONLINE',
    label: '업무중',
    dotColor: PERSON_TONES.work.dot,
    bgTone: PERSON_TONES.work.badge,
    textColor: PERSON_TONES.work.text,
    icon: '🟢',
    desc: '기본 근무 중',
  },
  OFFLINE: {
    code: 'OFFLINE',
    label: '오프라인',
    dotColor: PERSON_TONES.offline.dot,
    bgTone: PERSON_TONES.offline.badge,
    textColor: PERSON_TONES.offline.text,
    icon: '⚪',
    desc: '퇴근 또는 미접속',
  },
  OUTSIDE: {
    code: 'OUTSIDE',
    label: '외근·출장',
    dotColor: PERSON_TONES.outside.dot,
    bgTone: PERSON_TONES.outside.badge,
    textColor: PERSON_TONES.outside.text,
    icon: '🔵',
    desc: '외부 미팅, 현장 방문 및 출장',
  },
  MEETING: {
    code: 'MEETING',
    label: '회의중',
    dotColor: PERSON_TONES.meeting.dot,
    bgTone: PERSON_TONES.meeting.badge,
    textColor: PERSON_TONES.meeting.text,
    icon: '🟣',
    desc: '온·오프라인 회의 진행 중',
  },
  FOCUS: {
    code: 'FOCUS',
    label: '집중근무',
    dotColor: PERSON_TONES.focus.dot,
    bgTone: PERSON_TONES.focus.badge,
    textColor: PERSON_TONES.focus.text,
    icon: '🔴',
    desc: '방해금지, 몰입 업무 중',
  },
  LEAVE: {
    code: 'LEAVE',
    label: '휴가',
    dotColor: PERSON_TONES.leave.dot,
    bgTone: PERSON_TONES.leave.badge,
    textColor: PERSON_TONES.leave.text,
    icon: '🏖️',
    desc: '연차·반차 부재 중',
  },
  AWAY: {
    code: 'AWAY',
    label: '자리비움',
    dotColor: PERSON_TONES.away.dot,
    bgTone: PERSON_TONES.away.badge,
    textColor: PERSON_TONES.away.text,
    icon: '🟠',
    desc: '잠시 자리를 비움',
  },
};

export const userPresenceSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(USER_PRESENCE_STATUSES).default('ONLINE'),
  message: z.string().max(80).default(''),
  updatedAt: z.string(),
  /** 사용자가 상태를 직접 바꾼 시각(updatedAt)과 별개인 마지막 접속 신호 시각 */
  lastSeenAt: z.string().nullable().optional(),
  /** 마지막 키보드·마우스 활동 시각 — 자리비움 판정 */
  lastActiveAt: z.string().nullable().optional(),
});

export type UserPresence = z.infer<typeof userPresenceSchema>;
