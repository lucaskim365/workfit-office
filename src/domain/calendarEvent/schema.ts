import { z } from 'zod';
import { isValidCalendarDate } from './calendarDate';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '시각은 HH:mm 형식이어야 합니다.');

export const calendarEventSchema = z.object({
  id: z.string().regex(/^CAL-\d{8}-\d{4}$/, '일정 ID 형식이 올바르지 않습니다.'),
  ownerUserId: z.string().min(1),
  title: z.string().trim().min(1, '일정 제목을 입력하세요.').max(100),
  date: z.string().refine(isValidCalendarDate, '올바른 일정 날짜를 입력하세요.'),
  allDay: z.boolean(),
  startTime: timeSchema.nullable(),
  endTime: timeSchema.nullable(),
  memo: z.string().trim().max(2_000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).superRefine((value, ctx) => {
  if (value.allDay && (value.startTime !== null || value.endTime !== null)) {
    ctx.addIssue({ code: 'custom', path: ['startTime'], message: '종일 일정에는 시작·종료 시각을 지정할 수 없습니다.' });
  }
  if (!value.allDay && (!value.startTime || !value.endTime)) {
    ctx.addIssue({ code: 'custom', path: ['startTime'], message: '시간 일정에는 시작·종료 시각이 필요합니다.' });
  }
  if (!value.allDay && value.startTime && value.endTime && value.startTime >= value.endTime) {
    ctx.addIssue({ code: 'custom', path: ['endTime'], message: '종료 시각은 시작 시각보다 늦어야 합니다.' });
  }
});

export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CalendarEventDraft = Omit<CalendarEvent, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>;
