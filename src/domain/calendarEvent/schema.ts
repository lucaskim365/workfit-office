import { z } from 'zod';
import { isValidCalendarDate } from './calendarDate';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '시각은 HH:mm 형식이어야 합니다.');

/**
 * 일정 공개 범위.
 *
 * 앞의 셋은 업무관리 `WORK_VISIBILITIES`와 같은 뜻이다 — 같은 말을 다르게 쓰면 화면마다
 * 다른 규칙인 줄 알게 된다. `PROJECT`만 일정에 더 있는 축으로, 부서와 무관하게 특정
 * 프로젝트 참여자에게만 보인다.
 */
export const CALENDAR_VISIBILITIES = ['PRIVATE', 'TEAM', 'COMPANY', 'PROJECT'] as const;

export const CALENDAR_VISIBILITY_LABELS: Record<CalendarVisibility, string> = {
  PRIVATE: '나만 보기',
  TEAM: '부서 공유',
  COMPANY: '전사 공개',
  PROJECT: '프로젝트 공유',
};

export const calendarEventSchema = z.object({
  id: z.string().regex(/^CAL-\d{8}-\d{4}$/, '일정 ID 형식이 올바르지 않습니다.'),
  ownerUserId: z.string().min(1),
  title: z.string().trim().min(1, '일정 제목을 입력하세요.').max(100),
  date: z.string().refine(isValidCalendarDate, '올바른 일정 날짜를 입력하세요.'),
  allDay: z.boolean(),
  startTime: timeSchema.nullable(),
  endTime: timeSchema.nullable(),
  memo: z.string().trim().max(2_000),
  /*
    기존 일정에는 이 세 필드가 없다. 마이그레이션 없이 읽히도록 기본값을 둔다 —
    값이 없으면 `PRIVATE`, 즉 **지금까지처럼 나만 보이는 일정**이 된다. 기본값을 공유 쪽으로
    두면 마이그레이션 한 번 빠뜨렸을 때 남의 일정이 통째로 열린다.
  */
  visibility: z.enum(CALENDAR_VISIBILITIES).default('PRIVATE'),
  /** `TEAM`일 때 공유 대상 부서. 그 외 범위에서는 판정에 쓰이지 않는다. */
  deptId: z.string().nullable().default(null),
  /** `PROJECT`일 때 공유 대상 프로젝트. 그 외 범위에서는 판정에 쓰이지 않는다. */
  projectId: z.string().nullable().default(null),
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
  /*
    대상 없는 공유는 막는다. 부서 공유인데 부서가 비면 아무에게도 안 보이는데 화면에는
    "공유됨"으로 뜬다 — 공유한 줄 알고 있다가 아무도 못 보는 쪽이 제일 나쁘다.
  */
  if (value.visibility === 'TEAM' && !value.deptId) {
    ctx.addIssue({ code: 'custom', path: ['deptId'], message: '부서 공유 일정에는 공유할 부서가 필요합니다.' });
  }
  if (value.visibility === 'PROJECT' && !value.projectId) {
    ctx.addIssue({ code: 'custom', path: ['projectId'], message: '프로젝트 공유 일정에는 공유할 프로젝트가 필요합니다.' });
  }
});

export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CalendarVisibility = (typeof CALENDAR_VISIBILITIES)[number];
export type CalendarEventDraft = Omit<CalendarEvent, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>;
