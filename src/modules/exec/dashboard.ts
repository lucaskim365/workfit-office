import type { CalendarEvent } from '@/domain/calendarEvent/schema';
import type { CommuteStatus } from '@/domain/commute/schema';
import type { WorkProject } from '@/domain/workProject/schema';

/** 대시보드 근태 4분류 — 시안(출근·출근 전/휴무·지각·휴가)과 같은 색 묶음 */
export type AttendanceBucket = 'work' | 'pending' | 'late' | 'leave';

export const ATTENDANCE_BUCKETS: AttendanceBucket[] = ['pending', 'leave', 'work', 'late'];

export const ATTENDANCE_LABELS: Record<AttendanceBucket, string> = {
  work: '출근',
  pending: '휴무/기타',
  late: '지각',
  leave: '휴가',
};

/** 근태 판정 → 4분류. 외근·출장·휴일근무는 일한 날이라 출근, 결근·미기록·휴무는 휴무/기타 */
export function bucketOf(status: CommuteStatus): AttendanceBucket {
  switch (status) {
    case 'normal':
    case 'holiday_work':
    case 'outside':
    case 'trip':
    case 'missing_out':
      return 'work';
    case 'late':
      return 'late';
    case 'leave':
      return 'leave';
    default:
      return 'pending';
  }
}

/** 한국 시간 오늘 'YYYY-MM-DD' */
export function todayKst(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 'YYYY-MM' 의 날짜 목록 */
export function monthDates(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** 그 달 1일의 요일(0=일) */
export function firstWeekday(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** 회사 주요 일정 — 그날의 전사 공개·회사 행사 일정(시간순, 종일 먼저) */
export function companyEventsOn(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events
    .filter((e) => e.date === date && (e.visibility === 'COMPANY' || e.eventType === 'COMPANY_EVENT'))
    .sort((a, b) => (a.allDay === b.allDay ? (a.startTime ?? '').localeCompare(b.startTime ?? '') : a.allDay ? -1 : 1));
}

/**
 * 프로젝트 기간 경과율(0~100) — 프로젝트에 진척률 칸이 없어 시작일~종료일 중 오늘까지 지난 비율로 보인다.
 * 기간을 모르면 null.
 */
export function elapsedPercent(project: Pick<WorkProject, 'startAt' | 'dueAt' | 'contractStartAt' | 'contractEndAt'>, now = new Date()): number | null {
  const start = Date.parse(project.startAt ?? project.contractStartAt ?? '');
  const end = Date.parse(project.dueAt ?? project.contractEndAt ?? '');
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  const ratio = (now.getTime() - start) / (end - start);
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
}
