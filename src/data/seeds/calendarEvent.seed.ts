import type { z } from 'zod';
import { calendarEventSchema } from '@/domain/calendarEvent/schema';

/*
  파싱 **전** 값이라 공개 범위 필드를 생략할 수 있다. 아래 `parse`가 기본값 `PRIVATE`를
  채우므로 기존 시드는 전부 나만 보는 일정으로 남는다.
*/
const rows: z.input<typeof calendarEventSchema>[] = [
  {
    id: 'CAL-20260812-0003',
    ownerUserId: 'U009',
    title: '프로젝트 일정 확인',
    date: '2026-08-12',
    allDay: true,
    startTime: null,
    endTime: null,
    memo: '진행 중인 프로젝트 일정을 확인합니다.',
    createdAt: '2026-08-11T05:40:00.000Z',
    updatedAt: '2026-08-11T05:40:00.000Z',
  },
  {
    id: 'CAL-20260813-0002',
    ownerUserId: 'U009',
    title: '주간 일정 정리',
    date: '2026-08-13',
    allDay: false,
    startTime: '09:30',
    endTime: '10:00',
    memo: '',
    createdAt: '2026-08-11T05:45:00.000Z',
    updatedAt: '2026-08-11T05:45:00.000Z',
  },
  {
    id: 'CAL-20260812-0001',
    ownerUserId: 'U011',
    title: '주간 계획 정리',
    date: '2026-08-12',
    allDay: true,
    startTime: null,
    endTime: null,
    memo: '이번 주 개인 일정을 정리합니다.',
    createdAt: '2026-08-11T06:00:00.000Z',
    updatedAt: '2026-08-11T06:00:00.000Z',
  },
  {
    id: 'CAL-20260813-0001',
    ownerUserId: 'U011',
    title: '개인 일정 점검',
    date: '2026-08-13',
    allDay: false,
    startTime: '10:00',
    endTime: '11:00',
    memo: '',
    createdAt: '2026-08-11T06:10:00.000Z',
    updatedAt: '2026-08-11T06:10:00.000Z',
  },
  {
    id: 'CAL-20260812-0002',
    ownerUserId: 'U012',
    title: '다른 사용자 개인 일정',
    date: '2026-08-12',
    allDay: true,
    startTime: null,
    endTime: null,
    memo: '',
    createdAt: '2026-08-11T06:20:00.000Z',
    updatedAt: '2026-08-11T06:20:00.000Z',
  },
];

export const CALENDAR_EVENT_SEED = rows.map((row) => calendarEventSchema.parse(row));
