import { useEffect, useMemo, useRef, useState } from 'react';
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
 * 날짜가 바뀔 때만 채우므로 작성자가 고친 값은 덮어쓰지 않는다(임시저장·수정 중인 문서는 처음 열 때 채우지 않는다).
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

  // 이미 값이 있는 문서(임시저장·반려 후 수정, 예전 서식으로 쓴 문서)는 처음 열 때 채우지 않는다 — 근무 시간을 지우지 않게
  const filledDate = useRef(clockOf(values.workStart) || clockOf(values.workEnd) || values.workHours ? workDate : '');
  useEffect(() => {
    if (!ready) return;
    const next = overtimeFillOf(workDate, nowLocalIso().slice(0, 10), record, holidayName);
    setFill(next);
    onFill(next);
    if (filledDate.current === workDate) return;
    filledDate.current = workDate;
    setVals({ workKind: next.workKind, workStart: next.workStart, workEnd: next.workEnd, workHours: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 날짜·기록이 정해질 때만 채운다
  }, [ready, workDate, record, holidayName]);

  // 시각이나 종류가 바뀌면 근무 시간을 다시 계산한다(직접 고친 근무 시간은 그다음 시각 변경 전까지 둔다)
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
  const planned = fill.marks.workStart === '예정' || fill.marks.workEnd === '예정';
  return (
    <p className={`mb-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] ${missing ? 'bg-amber/10 text-amber-700' : 'bg-teal-soft text-teal'}`}>
      <Clock size={14} className="shrink-0" />
      {!missing
        ? '근태 기록에서 출근·퇴근 시각을 불러왔습니다.'
        : planned
          ? '아직 기록이 없는 시각은 예정 시각을 입력해 주세요. 문서에 (예정)으로 표시됩니다.'
          : '근태 기록이 없는 시각은 직접 입력해 주세요. 문서에 (수동 입력)으로 표시됩니다.'}
    </p>
  );
}
