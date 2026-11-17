/**
 * 시트 휴가원 — 기존 양식 휴가원과 같은 '사용기간 및 휴가 정보 선택' 창(LeavePeriodPicker)으로 고른 값을 시트 칸에 넣는다.
 * 칸은 연동 이름으로 찾는다: 휴가 기간(period)·휴가 종료일(period__end)·휴가 종류(leaveType)·시작 시각(startTime)·종료 시각(endTime).
 * 시트에 칸이 없는 값(반차 단위·반반차 시작·일수)은 문서 값으로만 남긴다(leaveDocExtras).
 */
import type { Sheet } from '@/lib/sheet/core';
import type { LeaveDocValues } from '@/domain/leave/leavePicker';
import { APPROVAL_NS, type CellInput } from './approvalSheet';

/** 누르면 선택 창이 뜨는 칸의 이름 — 이 칸들은 기안자가 직접 고치지 않는다(기간과 종류가 어긋나지 않게) */
export const LEAVE_PICKER_NAMES = ['period', 'period__end', 'leaveType'] as const;

/** 이름 붙은 칸의 입력 종류 — 그 이름의 칸이 없으면 undefined */
function inputTypeOfName(s: Sheet, name: string): string | undefined {
  const key = Object.entries(s.cellMeta[APPROVAL_NS.name] ?? {}).find(([, n]) => n === name)?.[0];
  if (!key) return undefined;
  return (s.cellMeta[APPROVAL_NS.input]?.[key] as CellInput | undefined)?.type ?? '';
}

/**
 * 고른 값 → { 칸 이름: 칸에 넣을 글자 }. 휴가 기간 칸이 기간 칸이면 '시작 ~ 끝', 날짜 칸이면 시작일만
 * (끝 날짜는 휴가 종료일 칸이 있으면 그 칸에).
 */
export function leaveCellValues(s: Sheet, v: LeaveDocValues): Record<string, string> {
  const to = v.period__end || v.period;
  const out: Record<string, string> = {
    period: inputTypeOfName(s, 'period') === 'dateRange' ? `${v.period} ~ ${to}` : v.period,
    leaveType: v.leaveType,
    startTime: v.startTime,
    endTime: v.endTime,
  };
  if (inputTypeOfName(s, 'period__end') !== undefined) out.period__end = to;
  return out;
}

/** 문서 값으로 남길 것 — 시트 칸과 상관없이 휴가 차감·근태·캘린더가 읽는 값(기존 양식 휴가원이 넣는 것과 같음) */
export function leaveDocExtras(v: LeaveDocValues): Record<string, string> {
  return {
    leaveType: v.leaveType,
    period: v.period,
    period__end: v.period__end || v.period,
    period__days: String(v.days),
    startTime: v.startTime,
    endTime: v.endTime,
    leaveUnit: v.leaveUnit,
    quarterStart: v.quarterStart,
  };
}
