import { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { useCommuteBootstrap, useCommuteMonth, useCommuteViewer } from '@/features/commute/useCommute';
import { useCommutePolicy } from '@/features/commute/useCommutePolicy';
import { useHolidays } from '@/features/holiday/useHolidays';
import { DEFAULT_COMMUTE_POLICY } from '@/domain/commutePolicy/schema';
import { clockOf, overtimeFillOf, overtimeHours, type OvertimeFill } from '@/domain/commute/overtimeDraft';
import { nowLocalIso } from '@/shared/lib/datetime';
import type { FieldValue } from '@/domain/approvalForm/schema';

/**
 * 휴일근로 신청서 — 근무 일자를 고르면 내 근태 기록으로 칸을 채우고 안내를 보인다.
 * 사후 신청만 받으므로(2026-11) 출근·퇴근 시각·근무 시간은 늘 근태 기록에서 채우고 기안자가 고칠 수 없다(isHolidayWorkLocked).
 */
export function OvertimeAutoFill({
  workDate,
  values,
  setVals,
  onFill,
}: {
  workDate: string;
  values: Record<string, FieldValue>;
  setVals: (patch: Record<string, FieldValue>) => void;
  onFill: (fill: OvertimeFill) => void;
}) {
  const month = workDate.slice(0, 7);
  const { isSettled } = useCommuteBootstrap(month, false);
  const viewer = useCommuteViewer({ enabled: isSettled });
  const empId = viewer.data?.empId ?? null;
  const monthQuery = useCommuteMonth(empId, month, { enabled: isSettled });
  const { data: holidays = [] } = useHolidays();
  const { policy = DEFAULT_COMMUTE_POLICY } = useCommutePolicy();
  const [fill, setFill] = useState<OvertimeFill | null>(null);

  const ready = viewer.isFetched && (empId === null || monthQuery.isFetched);
  const record = useMemo(() => monthQuery.data?.find((r) => r.date === workDate) ?? null, [monthQuery.data, workDate]);
  const holidayName = holidays.find((h) => h.date === workDate)?.name;

  // 사후 신청만 받으므로 시각은 늘 근태 기록에서 — 임시저장·반려 후 다시 연 문서도 지금 근태 기록으로 맞춘다(기안자가 고칠 수 없음)
  useEffect(() => {
    if (!ready) return;
    const next = overtimeFillOf(workDate, nowLocalIso().slice(0, 10), record, holidayName);
    setFill(next);
    onFill(next);
    if (clockOf(values.workStart) === next.workStart && clockOf(values.workEnd) === next.workEnd) return;
    setVals({ workKind: next.workKind, workStart: next.workStart, workEnd: next.workEnd, workHours: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 날짜·기록이 정해질 때만 채운다
  }, [ready, workDate, record, holidayName]);

  // 시각·종류로 근무 시간을 계산한다
  const kind = String(values.workKind || '휴일');
  const start = String(values.workStart ?? '');
  const end = String(values.workEnd ?? '');
  useEffect(() => {
    const hours = overtimeHours(kind, start, end, policy);
    if (hours !== null) setVals({ workHours: String(hours) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 시각·종류 변경에만 반응한다
  }, [kind, start, end, policy]);

  if (!ready) {
    return (
      <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-panel-alt px-3 py-2 text-[12px] text-ink3">
        <Clock size={14} className="shrink-0" /> 근태 기록을 불러오는 중…
      </p>
    );
  }
  if (!fill) return null;
  const missing = fill.marks.workStart || fill.marks.workEnd;
  return (
    <p className={`mb-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] ${missing ? 'bg-amber/10 text-amber-700' : 'bg-teal-soft text-teal'}`}>
      <Clock size={14} className="shrink-0" />
      {!missing
        ? '근태 기록에서 출근·퇴근 시각을 불러왔습니다. 휴일근로는 근무를 마친 뒤(사후) 신청합니다.'
        : '이 날 근태 기록에 출근·퇴근 시각이 없어 신청할 수 없습니다. 휴일근로는 근무를 마친 뒤(사후) 신청하며, 기록이 빠졌으면 근태 정정을 먼저 해 주세요.'}
    </p>
  );
}
