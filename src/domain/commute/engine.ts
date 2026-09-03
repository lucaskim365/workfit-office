import type { CommutePolicy } from '@/domain/commutePolicy/schema';
import type { CommuteRecord, CommuteStatus } from '@/domain/commute/schema';

/**
 * 대한민국 법정 공휴일 (고정 및 2025~2027 대체공휴일/명절 포함)
 */
const KOREAN_HOLIDAYS: Record<string, string> = {
  // ── 2025년 ──
  '2025-01-01': '신정',
  '2025-01-28': '설날 연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날 연휴',
  '2025-03-01': '삼일절',
  '2025-03-03': '삼일절 대체공휴일',
  '2025-05-05': '어린이날',
  '2025-05-06': '부처님오신날',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석 연휴',
  '2025-10-06': '추석',
  '2025-10-07': '추석 연휴',
  '2025-10-08': '추석 대체공휴일',
  '2025-10-09': '한글날',
  '2025-12-25': '성탄절',

  // ── 2026년 ──
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '삼일절 대체공휴일',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '부처님오신날 대체공휴일',
  '2026-06-03': '지방선거일',
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-08-17': '광복절 대체공휴일',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-09-28': '추석 대체공휴일',
  '2026-10-03': '개천절',
  '2026-10-05': '개천절 대체공휴일',
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절',

  // ── 2027년 ──
  '2027-01-01': '신정',
  '2027-02-06': '설날 연휴',
  '2027-02-07': '설날',
  '2027-02-08': '설날 연휴',
  '2027-02-09': '설날 대체공휴일',
  '2027-03-01': '삼일절',
  '2027-05-05': '어린이날',
  '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일',
  '2027-06-07': '현충일 대체공휴일',
  '2027-08-15': '광복절',
  '2027-08-16': '광복절 대체공휴일',
  '2027-09-14': '추석 연휴',
  '2027-09-15': '추석',
  '2027-09-16': '추석 연휴',
  '2027-10-03': '개천절',
  '2027-10-04': '개천절 대체공휴일',
  '2027-10-09': '한글날',
  '2027-10-11': '한글날 대체공휴일',
  '2027-12-25': '성탄절',
};

/** 고정 매년 양력 공휴일 (월-일) */
const RECURRING_HOLIDAYS: Record<string, string> = {
  '01-01': '신정',
  '03-01': '삼일절',
  '05-05': '어린이날',
  '06-06': '현충일',
  '08-15': '광복절',
  '10-03': '개천절',
  '10-09': '한글날',
  '12-25': '성탄절',
};

/**
 * 주어진 날짜(YYYY-MM-DD)의 대한민국 공휴일 명칭 반환 (공휴일이 아니면 null)
 */
export function getKoreanHoliday(dateStr: string): string | null {
  if (KOREAN_HOLIDAYS[dateStr]) return KOREAN_HOLIDAYS[dateStr];
  const mmdd = dateStr.slice(5);
  return RECURRING_HOLIDAYS[mmdd] ?? null;
}

/** 주말(토/일) 여부 확인 */
export function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * 시각 문자열(HH:mm) 또는 ISO 문자열을 하루 기준 분(0~1440)으로 변환.
 */
export function timeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  if (timeStr.includes('T')) {
    const d = new Date(timeStr);
    if (Number.isNaN(d.getTime())) return null;
    return d.getHours() * 60 + d.getMinutes();
  }
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export interface ApprovedLeaveInfo {
  leaveType: string;
  docTitle?: string;
  docId?: string;
}

/**
 * 정책(CommutePolicy)과 출/퇴근 시각, 공휴일 및 승인 휴가를 기반으로 근태 레코드 상태 및 시간을 정밀 계산합니다.
 */
export function evaluateCommuteRecord(
  raw: {
    empId: number;
    date: string;
    inAt: string | null;
    outAt: string | null;
    status?: CommuteStatus;
  },
  policy: CommutePolicy,
  leaveMap?: Map<string, ApprovedLeaveInfo>
): CommuteRecord {
  const { inAt, outAt, empId, date } = raw;
  const holiday = getKoreanHoliday(date);
  const weekend = isWeekend(date);
  const approvedLeave = leaveMap?.get(date);

  const now = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const isFuture = date > todayStr;

  // 1. 미출근 / 미기록 처리 (출/퇴근 모두 없는 날)
  if (!inAt && !outAt) {
    // 1-1. 승인된 휴가가 존재하는 경우 -> 결근이 아닌 'leave'(휴가)로 확정 (미래 휴가도 예정으로 표시)
    if (approvedLeave) {
      return {
        empId,
        date,
        inAt: null,
        outAt: null,
        basicMin: 0,
        overMin: 0,
        nightMin: 0,
        lateMin: 0,
        totalMin: 0,
        status: 'leave',
        leaveName: approvedLeave.leaveType,
        holidayName: holiday ?? undefined,
      };
    }

    // 1-2. 주말 또는 법정 공휴일인 경우 -> 'off'(휴무/공휴일)로 확정
    if (weekend || holiday) {
      return {
        empId,
        date,
        inAt: null,
        outAt: null,
        basicMin: 0,
        overMin: 0,
        nightMin: 0,
        lateMin: 0,
        totalMin: 0,
        status: 'off',
        holidayName: holiday ?? (weekend ? '주말 휴무' : undefined),
      };
    }

    // 1-3. 미래 날짜(오늘 이후)인 경우 -> 결근이 아닌 'unknown'(미도래/예정) 처리
    if (isFuture) {
      return {
        empId,
        date,
        inAt: null,
        outAt: null,
        basicMin: 0,
        overMin: 0,
        nightMin: 0,
        lateMin: 0,
        totalMin: 0,
        status: 'unknown',
        holidayName: holiday ?? undefined,
      };
    }

    // 1-4. 과거 또는 오늘 평일이면서 휴가 신청도 없는 경우에만 -> 'absent'(결근)
    return {
      empId,
      date,
      inAt: null,
      outAt: null,
      basicMin: 0,
      overMin: 0,
      nightMin: 0,
      lateMin: 0,
      totalMin: 0,
      status: raw.status === 'holiday_work' ? 'holiday_work' : raw.status === 'off' ? 'off' : 'absent',
      holidayName: holiday ?? undefined,
    };
  }

  // 2. 출근 또는 퇴근 한쪽만 있는 경우 (미기록)
  if (inAt && !outAt) {
    return {
      empId,
      date,
      inAt,
      outAt: null,
      basicMin: 0,
      overMin: 0,
      nightMin: 0,
      lateMin: 0,
      totalMin: 0,
      status: 'missing_out',
      leaveName: approvedLeave?.leaveType,
      holidayName: holiday ?? undefined,
    };
  }

  if (!inAt && outAt) {
    return {
      empId,
      date,
      inAt: null,
      outAt,
      basicMin: 0,
      overMin: 0,
      nightMin: 0,
      lateMin: 0,
      totalMin: 0,
      status: 'missing_in',
      leaveName: approvedLeave?.leaveType,
      holidayName: holiday ?? undefined,
    };
  }

  const inMin = timeToMinutes(inAt)!;
  const outMin = timeToMinutes(outAt)!;

  const policyStartMin = timeToMinutes(policy.workStartTime)!;
  const policyEndMin = timeToMinutes(policy.workEndTime)!;
  const policyLateThreshold = policyStartMin + (policy.lateGraceMin || 0);

  // 3. 지각(late) 판정 (주말/공휴일 출근 시는 휴일근무로 처리)
  let lateMin = 0;
  let status: CommuteStatus = 'normal';

  if (weekend || holiday) {
    status = 'holiday_work';
  } else if (inMin > policyLateThreshold) {
    lateMin = inMin - policyStartMin;
    status = 'late';
  }

  // 4. 연장근무(overMin) 판정
  let overMin = 0;
  if (outMin > policyEndMin) {
    const diff = outMin - policyEndMin;
    if (diff >= policy.overtimeStartMin) {
      overMin = diff;
    }
  }

  // 5. 야간근무(nightMin) 판정 (22:00 = 1320분 이후)
  const nightStartMin = timeToMinutes(policy.nightStartTime) ?? 1320;
  let nightMin = 0;
  if (outMin > nightStartMin) {
    nightMin = outMin - nightStartMin;
  }

  // 6. 기본 근무시간(basicMin) 및 총 근무시간(totalMin)
  const earlyLimitMin = timeToMinutes(policy.earlyInLimitTime) ?? 420;
  const effectiveInMin = Math.max(inMin, earlyLimitMin);
  const stayMin = Math.max(0, outMin - effectiveInMin);
  const breakMin = stayMin >= 240 ? policy.breakMin : 0;
  const totalMin = Math.max(0, stayMin - breakMin);
  const standardWorkMin = Math.max(0, policyEndMin - policyStartMin - policy.breakMin);
  const basicMin = Math.min(standardWorkMin, Math.max(0, totalMin - overMin));

  return {
    empId,
    date,
    inAt,
    outAt,
    basicMin,
    overMin,
    nightMin,
    lateMin,
    totalMin,
    status,
    leaveName: approvedLeave?.leaveType,
    holidayName: holiday ?? undefined,
  };
}
