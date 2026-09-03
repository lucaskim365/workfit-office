import type { CommutePolicy } from '@/domain/commutePolicy/schema';
import type { CommuteRecord, CommuteStatus } from '@/domain/commute/schema';

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

/**
 * 정책(CommutePolicy)과 출/퇴근 시각을 기반으로 근태 레코드의 상태 및 근로시간을 정밀 재계산합니다.
 */
export function evaluateCommuteRecord(
  raw: {
    empId: number;
    date: string;
    inAt: string | null;
    outAt: string | null;
    status?: CommuteStatus;
  },
  policy: CommutePolicy
): CommuteRecord {
  const { inAt, outAt, empId, date } = raw;

  // 1. 미출근 / 결근 처리
  if (!inAt && !outAt) {
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
    };
  }

  const inMin = timeToMinutes(inAt)!;
  const outMin = timeToMinutes(outAt)!;

  const policyStartMin = timeToMinutes(policy.workStartTime)!;
  const policyEndMin = timeToMinutes(policy.workEndTime)!;
  const policyLateThreshold = policyStartMin + (policy.lateGraceMin || 0);

  // 3. 지각(late) 판정
  let lateMin = 0;
  let status: CommuteStatus = 'normal';
  if (inMin > policyLateThreshold) {
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
  // 조기 출근 제한선 적용
  const earlyLimitMin = timeToMinutes(policy.earlyInLimitTime) ?? 420;
  const effectiveInMin = Math.max(inMin, earlyLimitMin);

  // 총 체류시간
  const stayMin = Math.max(0, outMin - effectiveInMin);

  // 휴게시간 공제 (기본 60분)
  const breakMin = stayMin >= 240 ? policy.breakMin : 0;
  const totalMin = Math.max(0, stayMin - breakMin);

  // 정규 기본 근로(최대 정책 근무시간 - 휴게시간)
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
  };
}
