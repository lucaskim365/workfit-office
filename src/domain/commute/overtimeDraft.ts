import type { CommutePolicy } from '@/domain/commutePolicy/schema';
import type { CommuteRecord } from './schema';

/**
 * 휴일근로 신청서(서식 코드 '휴일근무', 예전 문서는 '연장근로') 자동 입력 — 근무 일자의 내 근태 기록으로 출퇴근 시각·근무 시간을 채운다.
 * 칸은 서식의 키로 찾는다(workDate·workStart·workEnd·workHours). workStart 칸이 없는 서식은 자동 입력을 하지 않는다.
 */
export const OVERTIME_AUTOFILL_FIELD = 'workStart';
/** 주말·공휴일만 고를 수 있는 근무 일자 칸 — 사후 신청만 받으므로 오늘까지 */
export const HOLIDAY_WORK_DATE_KEY = 'workDate';

/**
 * 휴일근로 신청서는 사후 신청·승인만 한다(2026-11) — 출근·퇴근 시각과 근무 시간은 근태 기록에서만 채우고
 * 기안자가 고칠 수 없다(작성 화면에 글자로만 보인다). 근태 기록이 없는 날은 상신할 수 없다(근태 정정 먼저)
 */
export const HOLIDAY_WORK_LOCKED_KEYS: readonly string[] = ['workStart', 'workEnd', 'workHours'];
export const isHolidayWorkLocked = (key: string) => HOLIDAY_WORK_LOCKED_KEYS.includes(key);

export type OvertimeMark = '예정' | '수동 입력';

/** 소수점을 받는 숫자 칸 — 근무 시간(1.5시간 등). 다른 숫자·금액 칸은 지금처럼 정수만 받는다. */
const DECIMAL_NUMBER_KEYS = ['workHours'];
export const acceptsDecimal = (key: string) => DECIMAL_NUMBER_KEYS.includes(key);

/** 결재서식 숫자 칸의 입력값을 거른다 — 숫자만, 소수점 칸은 점 하나까지 */
export function numberFieldInput(key: string, raw: string): string {
  if (!acceptsDecimal(key)) return raw.replace(/[^0-9]/g, '');
  const [whole, ...rest] = raw.replace(/[^0-9.]/g, '').split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
}

export interface OvertimeFill {
  workKind: '휴일' | '연장';
  workStart: string;
  workEnd: string;
  /** 근태 기록에서 온 값이 아닌 칸의 표시 — 결재자가 문서에서 알아볼 수 있게 시각 뒤에 붙인다 */
  marks: { workStart?: OvertimeMark; workEnd?: OvertimeMark };
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

/** 'HH:mm' 또는 일시(ISO)를 한국 시각 'HH:mm' 으로. 시각이 아니면 빈 문자열. 표시('19:30 (예정)')가 붙어 있어도 읽는다. */
export function clockOf(value: unknown): string {
  const text = String(value ?? '').trim();
  const plain = text.match(/^(\d{1,2}):(\d{2})(?!\d|-)/);
  if (plain) {
    const [h, m] = [Number(plain[1]), Number(plain[2])];
    return h < 24 && m < 60 ? `${pad(h)}:${pad(m)}` : '';
  }
  const time = new Date(text).getTime();
  if (!text || Number.isNaN(time)) return '';
  const kst = new Date(time + KST_OFFSET_MS);
  return `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}

/** 주말·공휴일은 휴일, 그 외는 연장 (야간은 날짜로 정할 수 없어 작성자가 고른다) */
export function workKindOf(date: string, holidayName?: string | null): OvertimeFill['workKind'] {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return holidayName || day === 0 || day === 6 ? '휴일' : '연장';
}

/** 근무 일자와 근태 기록으로 채울 값을 정한다. 오늘 이후의 빈 시각은 예정, 지난 날의 빈 시각은 직접 입력이다. */
export function overtimeFillOf(
  date: string,
  today: string,
  record: Pick<CommuteRecord, 'inAt' | 'outAt'> | null | undefined,
  holidayName?: string | null,
): OvertimeFill {
  const workStart = clockOf(record?.inAt);
  const workEnd = clockOf(record?.outAt);
  const blank: OvertimeMark = date >= today ? '예정' : '수동 입력';
  return {
    workKind: workKindOf(date, holidayName),
    workStart,
    workEnd,
    marks: { ...(workStart ? {} : { workStart: blank }), ...(workEnd ? {} : { workEnd: blank }) },
  };
}

const minutesOf = (clock: string) => {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
};

/**
 * 근무 시간(시간 단위, 소수 첫째 자리). 시각이 비면 null.
 * 휴일은 출근~퇴근에서 휴게시간과 겹친 만큼 빼고, 그 외는 정규 퇴근 이후만 센다(정책의 인정 시작 분 미만은 0).
 * 퇴근이 출근보다 이르면 자정을 넘긴 것으로 본다.
 */
export function overtimeHours(
  kind: string,
  startValue: unknown,
  endValue: unknown,
  policy: Pick<CommutePolicy, 'workEndTime' | 'breakStartTime' | 'breakEndTime' | 'overtimeStartMin'>,
): number | null {
  const start = clockOf(startValue);
  const end = clockOf(endValue);
  if (!start || !end) return null;
  const from = minutesOf(start);
  const to = minutesOf(end) + (minutesOf(end) < from ? 24 * 60 : 0);
  let minutes: number;
  if (kind === '휴일') {
    const overlap = Math.min(to, minutesOf(policy.breakEndTime)) - Math.max(from, minutesOf(policy.breakStartTime));
    minutes = to - from - Math.max(0, overlap);
  } else {
    minutes = to - minutesOf(policy.workEndTime);
    if (minutes < policy.overtimeStartMin) minutes = 0;
  }
  return Math.round(Math.max(0, minutes) / 6) / 10;
}

/** 상신할 값 — 시각 뒤에 표시를 붙인다. 근태 기록과 다르게 고친 시각은 수동 입력으로 표시한다. */
export function markOvertimeTimes<T extends Record<string, unknown>>(values: T, fill: OvertimeFill): T {
  const marked: Record<string, unknown> = { ...values };
  for (const key of ['workStart', 'workEnd'] as const) {
    const clock = clockOf(values[key]);
    if (!clock) continue;
    const mark = fill.marks[key] ?? (clock === fill[key] ? undefined : '수동 입력');
    marked[key] = mark ? `${clock} (${mark})` : clock;
  }
  return marked as T;
}
