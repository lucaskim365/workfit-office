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

/** 하루 타임라인 축 — 08:00 ~ 20:00 */
export const DAY_START_MIN = 8 * 60;
export const DAY_END_MIN = 20 * 60;

/** 'HH:MM' → 분. 못 읽으면 null */
export function minutesOf(time: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * 타임라인 위 자리(축 대비 %) — 시작이 없으면 null(종일·시간 미정은 축 밖에 따로 둔다).
 * 끝이 없거나 시작보다 이르면 1시간으로 본다. 축 밖은 잘라 낸다.
 */
export function timelineSpan(start: string | null, end: string | null): { left: number; width: number } | null {
  const s = minutesOf(start);
  if (s === null) return null;
  let e = minutesOf(end);
  if (e === null || e <= s) e = s + 60;
  const span = DAY_END_MIN - DAY_START_MIN;
  const a = Math.min(Math.max(s, DAY_START_MIN), DAY_END_MIN);
  const b = Math.min(Math.max(e, DAY_START_MIN), DAY_END_MIN);
  if (b <= a) return null;
  return { left: ((a - DAY_START_MIN) / span) * 100, width: ((b - a) / span) * 100 };
}

/** 지금 시각의 축 위 자리(%) — 축 밖이면 null */
export function nowPercent(now = new Date()): number | null {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const min = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  if (min < DAY_START_MIN || min > DAY_END_MIN) return null;
  return ((min - DAY_START_MIN) / (DAY_END_MIN - DAY_START_MIN)) * 100;
}

/** 도넛 조각 — 합계 대비 시작·끝 각도(0~1). 값이 0인 조각은 뺀다 */
export function donutSlices<K extends string>(counts: Array<{ key: K; value: number }>): Array<{ key: K; value: number; from: number; to: number }> {
  const total = counts.reduce((s, c) => s + c.value, 0);
  if (total <= 0) return [];
  let acc = 0;
  return counts
    .filter((c) => c.value > 0)
    .map((c) => {
      const from = acc / total;
      acc += c.value;
      return { ...c, from, to: acc / total };
    });
}
