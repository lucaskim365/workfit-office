import { useMemo } from 'react';
import type { CommutePersonRow } from '../types';
import { getKoreanHoliday } from '@/domain/commute/engine';

interface CommuteMatrixViewProps {
  month: string;
  rows: CommutePersonRow[];
  onSelectPerson: (person: CommutePersonRow) => void;
}

const pad = (v: number) => String(v).padStart(2, '0');

function CellStatusBadge({ status, leaveName, holidayName }: { status: string; leaveName?: string; holidayName?: string }) {
  if (status === 'unknown') {
    return <span className="text-[10px] text-ink3/40 font-mono">—</span>;
  }
  if (status === 'leave') {
    return (
      <span className="inline-flex items-center justify-center rounded bg-emerald-500/15 px-1 py-0.2 text-[9px] font-extrabold text-emerald-600" title={leaveName || '휴가'}>
        🏖️
      </span>
    );
  }
  if (status === 'off') {
    if (holidayName && holidayName !== '주말 휴무') {
      return (
        <span className="text-[8.5px] font-bold text-rose-500 truncate max-w-[28px] inline-block" title={holidayName}>
          휴
        </span>
      );
    }
    return <span className="text-[9px] text-ink3/30">—</span>;
  }
  if (status === 'present' || status === 'normal') {
    return (
      <span className="inline-flex items-center justify-center font-black text-[10px] text-teal" title="정상 출근">
        ●
      </span>
    );
  }
  if (status === 'holiday_work') {
    return (
      <span className="inline-flex items-center justify-center rounded bg-indigo-500/20 px-1 py-0.2 text-[9px] font-bold text-indigo-600" title="휴일근무">
        휴근
      </span>
    );
  }
  if (status === 'late') {
    return (
      <span className="inline-flex items-center justify-center rounded bg-amber/20 px-1 py-0.2 text-[9.5px] font-black text-amber" title="지각">
        △
      </span>
    );
  }
  if (status === 'absent') {
    return (
      <span className="inline-flex items-center justify-center rounded bg-rose-500/20 px-1 py-0.2 text-[9.5px] font-black text-rose-600" title="결근">
        ✕
      </span>
    );
  }
  if (status === 'missing_in' || status === 'missing_out') {
    return (
      <span className="inline-flex items-center justify-center rounded bg-orange-500/20 px-1 py-0.2 text-[9.5px] font-black text-orange-600" title="출/퇴근 미기록">
        ❓
      </span>
    );
  }
  return <span className="text-[9px] text-ink3/50 font-mono">—</span>;
}

export function CommuteMatrixView({ month, rows, onSelectPerson }: CommuteMatrixViewProps) {
  const [year, mm] = month.split('-').map(Number);
  const daysInMonth = useMemo(() => {
    if (!year || !mm) return [];
    const totalDays = new Date(year, mm, 0).getDate();
    const days: { dateStr: string; dayNum: number; isSun: boolean; isSat: boolean; holiday: string | null }[] = [];
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${month}-${pad(d)}`;
      const dayOfWeek = new Date(year, mm - 1, d).getDay();
      days.push({
        dateStr,
        dayNum: d,
        isSun: dayOfWeek === 0,
        isSat: dayOfWeek === 6,
        holiday: getKoreanHoliday(dateStr),
      });
    }
    return days;
  }, [year, mm, month]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-2xs">
      {/* 상태 기호 범례 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-panel-alt/50 px-4 py-2 text-[11px] text-ink3">
        <div className="flex items-center gap-1.5 font-bold text-ink2">
          <span>전사 임직원 일자별 근태 매트릭스 ({rows.length}명)</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold">
          <span className="flex items-center gap-1"><span className="text-teal font-black">●</span> 정상</span>
          <span className="flex items-center gap-1"><span className="text-amber font-black">△</span> 지각</span>
          <span className="flex items-center gap-1"><span className="text-rose-600 font-black">✕</span> 결근</span>
          <span className="flex items-center gap-1"><span>🏖️</span> 휴가</span>
          <span className="flex items-center gap-1"><span className="text-orange-600 font-black">❓</span> 미기록</span>
          <span className="flex items-center gap-1"><span className="text-ink3">—</span> 휴무/미체크</span>
          <span className="text-ink3 font-normal">※ 직원 클릭 시 상세 내역 확인</span>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead className="sticky top-0 z-20 bg-panel-alt border-b border-border shadow-2xs">
            <tr className="text-[10.5px] font-bold text-ink2">
              <th className="sticky left-0 z-30 bg-panel-alt px-3 py-2.5 min-w-[140px] border-r border-border">
                직원 / 부서
              </th>
              {daysInMonth.map(({ dateStr, dayNum, isSun, isSat, holiday }) => (
                <th
                  key={dateStr}
                  className={`px-1 py-2 text-center min-w-[30px] border-r border-border/40 ${
                    holiday || isSun ? 'bg-rose-500/8 text-rose-500' : isSat ? 'bg-blue-500/8 text-blue-500' : ''
                  }`}
                  title={holiday ? `${dayNum}일 (${holiday})` : `${dayNum}일`}
                >
                  <div className="font-extrabold">{dayNum}</div>
                  <div className="text-[8.5px] font-medium opacity-80">
                    {isSun ? '일' : isSat ? '토' : ''}
                  </div>
                </th>
              ))}
              <th className="px-2.5 py-2 text-center min-w-[55px] border-r border-border bg-panel-alt text-ink">
                근무일
              </th>
              <th className="px-2.5 py-2 text-center min-w-[55px] bg-panel-alt text-rose-600">
                이상
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={daysInMonth.length + 3} className="py-16 text-center text-xs text-ink3">
                  조건에 일치하는 임직원이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.empId}
                  onClick={() => onSelectPerson(row)}
                  className="group hover:bg-panel-alt/70 cursor-pointer transition-colors"
                >
                  {/* 고정 직원 열 */}
                  <td className="sticky left-0 z-10 bg-panel group-hover:bg-panel-alt/90 px-3 py-2 border-r border-border min-w-[140px] shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-ink group-hover:text-teal transition-colors flex items-center gap-1.5">
                          <span>{row.name}</span>
                          <span className="text-[10px] font-normal text-ink3">
                            {row.position || '사원'}
                          </span>
                        </div>
                        <div className="text-[9.5px] text-ink3 truncate max-w-[110px]">
                          {row.dept || '부서 미지정'}
                        </div>
                      </div>
                      {row.anomalyCount > 0 && (
                        <span
                          className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500/15 px-1 text-[9px] font-extrabold text-rose-600 border border-rose-500/30"
                          title={`이상 근태 ${row.anomalyCount}건`}
                        >
                          {row.anomalyCount}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 일자별 상태 셀 */}
                  {daysInMonth.map(({ dateStr, isSun, isSat, holiday }) => {
                    const record = row.recordsMap.get(dateStr);
                    const status = record?.status ?? 'unknown';

                    return (
                      <td
                        key={dateStr}
                        className={`px-0.5 py-1.5 text-center border-r border-border/30 tabular-nums ${
                          holiday || isSun ? 'bg-rose-500/4' : isSat ? 'bg-blue-500/4' : ''
                        }`}
                        title={
                          record && (record.inAt || record.outAt)
                            ? `${record.date}: ${record.inAt ? record.inAt.slice(11, 16) : '미체크'} ~ ${record.outAt ? record.outAt.slice(11, 16) : '미체크'}`
                            : `${dateStr}`
                        }
                      >
                        <CellStatusBadge
                          status={status}
                          leaveName={record?.leaveName}
                          holidayName={record?.holidayName}
                        />
                      </td>
                    );
                  })}

                  {/* 근무일수 */}
                  <td className="px-2 py-1.5 text-center font-bold tabular-nums text-ink border-r border-border">
                    {row.summary.workDays}일
                  </td>

                  {/* 이상 건수 */}
                  <td className="px-2 py-1.5 text-center tabular-nums">
                    {row.anomalyCount > 0 ? (
                      <span className="inline-flex items-center justify-center rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-600 border border-rose-500/25">
                        {row.anomalyCount}건
                      </span>
                    ) : (
                      <span className="text-[10px] text-ink3/50 font-mono">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
