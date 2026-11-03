import type { CommuteRecord } from './schema';
import { HOLIDAY_WORK_TONE, PERSON_TONES } from '@/shared/theme/statusColors';
import { isHalfDayLeave, isQuarterDayLeave, QUARTER_LEAVE_SLOTS } from '@/domain/leave/policy';

/**
 * 근태 상태 표시 — 이름·짧은 표기·색의 단일 정의.
 *
 * 근태표·내 근태·직원 상세·PWA·캘린더·업무계획이 모두 이 정의로 그린다. 같은 상태가 화면마다
 * 다른 이름·색으로 보이지 않게 하려는 것이다. 판정은 [[engine]]이 하고, 여기는 보이는 방식만 정한다.
 */
export type StatusKind =
  | 'normal'
  | 'late'
  | 'absent'
  | 'missing'
  | 'annual'
  | 'half'
  | 'quarter'
  | 'leave'
  | 'outside'
  | 'trip'
  | 'holiday_work'
  | 'off';

export interface StatusTone {
  /** 배지(배경+테두리+글자) */
  badge: string;
  /** 글자색만 */
  text: string;
  /** 점·막대 */
  dot: string;
}

export const STATUS_TONES: Record<StatusKind, StatusTone> = {
  normal: { badge: PERSON_TONES.work.badge, text: PERSON_TONES.work.text, dot: PERSON_TONES.work.dot },
  late: {
    badge: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  absent: {
    badge: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
    text: 'text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  missing: {
    badge: 'bg-stone-500/10 border-stone-500/30 text-stone-600 dark:text-stone-400',
    text: 'text-stone-600 dark:text-stone-400',
    dot: 'bg-stone-400',
  },
  annual: { badge: PERSON_TONES.leave.badge, text: PERSON_TONES.leave.text, dot: PERSON_TONES.leave.dot },
  half: { badge: PERSON_TONES.leave.badgeLight, text: PERSON_TONES.leave.text, dot: PERSON_TONES.leave.dot },
  quarter: { badge: PERSON_TONES.leave.badgeLight, text: PERSON_TONES.leave.text, dot: PERSON_TONES.leave.dot },
  leave: { badge: PERSON_TONES.leave.badge, text: PERSON_TONES.leave.text, dot: PERSON_TONES.leave.dot },
  outside: { badge: PERSON_TONES.outside.badge, text: PERSON_TONES.outside.text, dot: PERSON_TONES.outside.dot },
  trip: { badge: PERSON_TONES.trip.badge, text: PERSON_TONES.trip.text, dot: PERSON_TONES.trip.dot },
  holiday_work: HOLIDAY_WORK_TONE,
  off: { badge: 'bg-panel-alt border-border text-ink3', text: 'text-ink3', dot: 'bg-ink3/40' },
};

export interface StatusChip {
  kind: StatusKind;
  /** 근태표 칸처럼 좁은 곳에 쓰는 짧은 표기 (예: 반차, 휴근) */
  short: string;
  /** 전체 이름 (예: 오전반차, 해외출장). 외근은 세부 구분 없이 늘 '외근' */
  label: string;
}

const clean = (v?: string | null) => (v ?? '').trim();

/** 휴가 종류 한 건의 표시. 연차·반차·반반차는 고정 표기, 나머지(대체휴무·경조·병가·공가 등)는 휴가 이름 그대로. */
export function leaveChip(leaveType?: string | null, title?: string | null, quarterSlot?: string | null): StatusChip {
  const t = clean(leaveType);
  if (isQuarterDayLeave(t, title)) {
    const slot = QUARTER_LEAVE_SLOTS.find((s) => s.key === quarterSlot);
    return { kind: 'quarter', short: '반반', label: slot ? `반반차 (${slot.label})` : '반반차' };
  }
  if (isHalfDayLeave(t, title)) {
    const text = `${t}${title ?? ''}`;
    const label = text.includes('오전') ? '오전반차' : text.includes('오후') ? '오후반차' : '반차';
    return { kind: 'half', short: '반차', label };
  }
  if (!t || t === '연차' || t === 'ANNUAL') return { kind: 'annual', short: '연차', label: '연차' };
  return { kind: 'leave', short: t, label: t };
}

export const chipOf = (kind: StatusKind, short: string, label = short): StatusChip => ({ kind, short, label });

/**
 * 근태 기록 하루를 배지 목록으로. 두 상태가 겹치면 둘 다 낸다(예: 반차 + 지각, 반차 + 외근).
 * 빈 배열이면 표시할 상태가 없다는 뜻(주말 휴무·입사 전·미래) — 화면은 '—' 등으로 그린다.
 */
export function describeCommuteRecord(rec: Pick<
  CommuteRecord,
  'status' | 'leaveName' | 'outsideName' | 'tripName' | 'holidayName' | 'lateMin'
> | null | undefined): StatusChip[] {
  if (!rec) return [];
  const leave = rec.leaveName ? leaveChip(rec.leaveName) : null;
  const withLeave = (...chips: StatusChip[]) => (leave ? [leave, ...chips] : chips);
  switch (rec.status) {
    case 'normal':
      return leave ? [leave] : [chipOf('normal', '정상')];
    case 'late':
      return withLeave(chipOf('late', '지각', rec.lateMin > 0 ? `지각 ${rec.lateMin}분` : '지각'));
    case 'absent':
      return [chipOf('absent', '결근')];
    case 'missing_in':
      return withLeave(chipOf('missing', '미체크', '출근 미기록'));
    case 'missing_out':
      return withLeave(chipOf('missing', '미체크', '퇴근 미기록'));
    case 'leave':
      return [leave ?? leaveChip('연차')];
    case 'outside':
      return withLeave(chipOf('outside', '외근', '외근'));
    case 'trip':
      return withLeave(chipOf('trip', '출장', clean(rec.tripName) || '출장'));
    case 'holiday_work':
      return [chipOf('holiday_work', '휴근', '휴일근무')];
    case 'off':
      // 주말·공휴일은 배지를 달지 않는다 — 승인 없는 출근도 출퇴근 시각만 보인다(공휴일은 날짜 머리에서 표시)
      return [];
    default:
      return [];
  }
}

/** 결재 일정 분류(휴가·외근·출장)의 표시 — 캘린더·업무계획 칩용. */
export function scheduleChip(s: {
  category: 'LEAVE' | 'OUTSIDE' | 'TRIP';
  leaveType?: string | null;
  subType?: string | null;
  docTitle?: string | null;
}): StatusChip {
  if (s.category === 'LEAVE') return leaveChip(s.leaveType, s.docTitle);
  if (s.category === 'OUTSIDE') return chipOf('outside', '외근', '외근');
  return chipOf('trip', '출장', clean(s.subType) || '출장');
}
