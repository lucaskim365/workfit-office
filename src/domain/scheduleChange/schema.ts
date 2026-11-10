import { z } from 'zod';
import { isValidCalendarDate } from '@/domain/calendarEvent/calendarDate';

/**
 * 결재 완료 외근·출장의 일정 변경 기록.
 *
 * 외근·출장은 날짜·시간이 자주 바뀌는데, 결재 문서는 고칠 수 없고 취소 기안은 번거롭다.
 * 그래서 문서는 그대로 두고 "언제로 바뀌었는지"만 이 컬렉션에 따로 남긴다(2026-11-10 결정).
 * 일정 정보를 뽑는 곳(`extractScheduleInfo`)이 마지막 기록을 덮어써서
 * 업무계획·캘린더·근태·재실 상태가 한 번에 바뀐 일정을 따른다.
 *
 * - 대상: 외근·출장만(휴가는 연차와 묶여 있어 취소 기안 그대로)
 * - 바꿀 수 있는 것: 날짜·시간만. 행선지·목적은 문서 그대로
 * - 바꾸는 사람: 기안자 본인과 관리자. 결재권자·동행자에게 알림
 * - 결재 문서(`approvalDocs`)는 읽기만 한다
 */

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '시각은 HH:mm 형식이어야 합니다.');
const dateSchema = z.string().refine(isValidCalendarDate, '올바른 날짜를 입력하세요.');

export const scheduleChangeSchema = z.object({
  id: z.string().regex(/^SC-[A-Za-z0-9-]{4,40}$/),
  /** 바꾼 결재 문서 id */
  docId: z.string().min(1).max(64),
  startDate: dateSchema,
  endDate: dateSchema,
  /** 둘 다 null 이면 종일 */
  startTime: timeSchema.nullable(),
  endTime: timeSchema.nullable(),
  /** 바뀌기 전 일정 — 이력 표시용 */
  prevStartDate: dateSchema,
  prevEndDate: dateSchema,
  prevStartTime: timeSchema.nullable(),
  prevEndTime: timeSchema.nullable(),
  reason: z.string().trim().min(1, '변경 사유를 입력하세요.').max(300),
  changedBy: z.string().min(1).max(64),
  changedByName: z.string().max(60).default(''),
  createdAt: z.string().min(1),
});
export type ScheduleChange = z.infer<typeof scheduleChangeSchema>;

/** 화면에서 넘기는 새 일정 */
export interface ScheduleChangeInput {
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string;
}

/** 입력 확인 — 틀린 곳이 있으면 안내 문구, 맞으면 null */
export function validateScheduleChange(input: ScheduleChangeInput): string | null {
  if (!isValidCalendarDate(input.startDate) || !isValidCalendarDate(input.endDate)) return '날짜를 확인하세요.';
  if (input.endDate < input.startDate) return '종료일은 시작일보다 빠를 수 없습니다.';
  if (!input.allDay) {
    if (!input.startTime || !input.endTime) return '시작·종료 시각을 입력하세요.';
    if (input.startDate === input.endDate && input.endTime <= input.startTime) return '종료 시각은 시작 시각보다 늦어야 합니다.';
  }
  if (!input.reason.trim()) return '변경 사유를 입력하세요.';
  if (input.reason.trim().length > 300) return '변경 사유는 300자까지 쓸 수 있습니다.';
  return null;
}

/** 문서별 마지막 변경 — 같은 문서를 여러 번 바꾸면 가장 나중 것이 지금 일정 */
export function latestChangeByDoc(changes: readonly ScheduleChange[]): Map<string, ScheduleChange> {
  const map = new Map<string, ScheduleChange>();
  for (const c of changes) {
    const prev = map.get(c.docId);
    if (!prev || prev.createdAt < c.createdAt || (prev.createdAt === c.createdAt && prev.id < c.id)) map.set(c.docId, c);
  }
  return map;
}

/** 한 문서의 변경 이력 — 오래된 것부터 */
export function changesOfDoc(changes: readonly ScheduleChange[], docId: string): ScheduleChange[] {
  return changes.filter((c) => c.docId === docId).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** 일정 한 줄 글 — '11/12 ~ 11/14 종일', '11/12 10:00~15:00' */
export function scheduleRangeText(startDate: string, endDate: string, startTime: string | null | undefined, endTime: string | null | undefined): string {
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  const dates = startDate === endDate ? md(startDate) : `${md(startDate)} ~ ${md(endDate)}`;
  return startTime && endTime ? `${dates} ${startTime}~${endTime}` : `${dates} 종일`;
}
