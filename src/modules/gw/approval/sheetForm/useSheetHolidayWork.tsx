import { useState, type ReactNode } from 'react';
import { linkSystemValues } from '@/domain/approvalForm/sheet/approvalSheet';
import { HOLIDAY_WORK_LOCKED_KEYS, type OvertimeFill } from '@/domain/commute/overtimeDraft';
import type { FieldValue } from '@/domain/approvalForm/schema';
import { OvertimeAutoFill } from '../components/OvertimeAutoFill';

const HOLIDAY_WORK = '휴일근무';
const NO_OP = () => {};

/**
 * 시트 휴일근무 신청서 — 근무 일자의 근태 기록으로 출근·퇴근 시각·근무 시간 칸을 채우고, 그 칸은 기안자가 못 고친다.
 * 기안 화면과 서식 편집기 미리보기가 같이 쓴다(SheetDraftForm 에 넘길 값과 위에 띄울 안내를 돌려준다).
 * active 가 아니면(휴일근무 연동이 아닌 시트) 다른 연동의 시스템 값(휴가 일수 등)만 계산한다.
 */
export function useSheetHolidayWork({ active, workDate, holidays }: { active: boolean; workDate: string; holidays: { date: string; name?: string }[] }) {
  const [state, setState] = useState<{ date: string; fill: OvertimeFill | null; hours: number | null }>({ date: '', fill: null, hours: null });
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(workDate);

  /** SheetDraftForm.systemValues — 휴일근무는 근태 기록 값(받아 온 날짜가 지금 근무 일자일 때만), 그 밖의 연동은 기존 계산 */
  const systemValues = (link: string, linked: Record<string, string>) => {
    if (link !== HOLIDAY_WORK) return linkSystemValues(link, linked, holidays);
    const ok = state.fill && state.date === linked.workDate;
    return {
      workStart: ok ? state.fill!.workStart : '',
      workEnd: ok ? state.fill!.workEnd : '',
      workHours: ok && state.hours !== null ? String(state.hours) : '',
    };
  };

  const banner: ReactNode =
    active && validDate ? (
      <OvertimeAutoFill
        key={workDate}
        workDate={workDate}
        values={{} as Record<string, FieldValue>}
        setVals={NO_OP}
        apply={false}
        onFill={(fill) => setState((p) => ({ date: workDate, fill, hours: p.date === workDate ? p.hours : null }))}
        onHours={(hours) => setState((p) => (p.hours === hours ? p : { ...p, hours }))}
      />
    ) : null;

  return {
    /** 근태 기록에서 받아 온 것 — 상신 전 검사(기록 없음·날짜 다름)에 쓴다 */
    fill: state.fill,
    filledDate: state.date,
    systemValues,
    banner,
    lockedNames: active ? HOLIDAY_WORK_LOCKED_KEYS : undefined,
    /** 받아 온 값이 바뀌면 시트에 다시 넣게 */
    systemKey: active ? `${state.date}|${state.fill?.workStart ?? ''}|${state.fill?.workEnd ?? ''}|${state.hours ?? ''}` : undefined,
  };
}
