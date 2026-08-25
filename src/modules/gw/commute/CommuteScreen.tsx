import { useEffect, useMemo, useState } from 'react';
import {
  COMMUTE_STATUS_LABELS,
  summarizeCommuteMonth,
  type CommuteEmployee,
  type CommuteRecord,
} from '@/domain/commute/schema';
import { COMMUTE_STATUS_TONES } from '@/data/commute/commute.fixture';
import { useCommuteDay, useCommuteEmployees, useCommuteMonth } from '@/features/commute/useCommute';
import { GwHead, GwSideNav, GwSplit } from '@/modules/gw/_gw';
import { Button } from '@/shared/ui/Button';

/**
 * 근태 조회 — CAPS 연동 데이터의 읽기 화면.
 *
 * 보는 방향이 둘이다. **개인별**은 한 사람의 한 달을 세로로 보고(누가 이번 달 어땠나),
 * **일별**은 하루를 전 직원 가로로 본다(오늘 누가 안 왔나). 좌측 목록에서 하나만 고르게
 * 해서 "무엇을 보는지"가 항상 한 곳에 드러나게 했다.
 *
 * 데이터는 읽기 전용이다. 쓰기는 CAPS 인제스트(서버 전용 키)만 한다. status는 계약상
 * 추정 매핑이라 참고용 안내를 함께 둔다.
 */
const DAY_VIEW = 'day';

const pad = (value: number) => String(value).padStart(2, '0');

const thisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

function moveMonth(month: string, amount: number): string {
  const [year, mm] = month.split('-').map(Number);
  const next = new Date(year, mm - 1 + amount, 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
}

function moveDay(date: string, amount: number): string {
  const [year, mm, dd] = date.split('-').map(Number);
  const next = new Date(year, mm - 1, dd + amount);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const dayTitle = (date: string): string => {
  const [year, mm, dd] = date.split('-').map(Number);
  return `${year}년 ${mm}월 ${dd}일 (${WEEKDAYS[new Date(year, mm - 1, dd).getDay()]})`;
};

const timeOf = (iso: string | null): string => {
  if (!iso) return '—';
  const at = new Date(iso);
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

const hourText = (min: number): string => (min === 0 ? '—' : `${Math.floor(min / 60)}h ${min % 60}m`);

/** 요약 배지 — 개인별·일별이 같은 모양을 쓴다. */
function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-1 text-[9.5px] font-bold ${tone}`}>{children}</span>;
}

function StatusBadge({ status }: { status: CommuteRecord['status'] }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${COMMUTE_STATUS_TONES[status]}`}>
      {COMMUTE_STATUS_LABELS[status]}
    </span>
  );
}

const NOTE = '상태 분류는 CAPS 원본 코드의 추정 매핑입니다. 확정 전에는 참고용으로만 보세요.';

export default function CommuteScreen() {
  const employeesQuery = useCommuteEmployees();
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

  /** 좌측 선택 = 보기 대상. `day`면 일별, 숫자면 그 사번의 월별. */
  const [view, setView] = useState<string>(DAY_VIEW);
  const [month, setMonth] = useState(thisMonth());
  const [date, setDate] = useState(today());

  const empId = view === DAY_VIEW ? null : Number(view);

  // 개인별로 처음 들어갈 때 아무도 안 골라져 있으면 첫 재직자를 고른다.
  useEffect(() => {
    if (view !== DAY_VIEW && Number.isNaN(Number(view)) && employees.length > 0) {
      setView(String((employees.find((row) => row.active) ?? employees[0]).empId));
    }
  }, [employees, view]);

  const monthQuery = useCommuteMonth(empId, month);
  const dayQuery = useCommuteDay(view === DAY_VIEW ? date : null);

  const monthRows = useMemo(() => monthQuery.data ?? [], [monthQuery.data]);
  const summary = useMemo(() => summarizeCommuteMonth(monthRows), [monthRows]);
  const selected = employees.find((row) => row.empId === empId);

  /** 일별 표 — 기록 없는 직원도 한 줄로 남긴다. 빠진 사람이 안 보이면 쓸모가 없다. */
  const dayRows = useMemo(() => {
    const byEmp = new Map<number, CommuteRecord>();
    for (const row of dayQuery.data ?? []) byEmp.set(row.empId, row);
    return employees
      .filter((row) => row.active)
      .map((employee: CommuteEmployee) => ({ employee, record: byEmp.get(employee.empId) ?? null }))
      .sort((a, b) => a.employee.name.localeCompare(b.employee.name, 'ko'));
  }, [dayQuery.data, employees]);

  const dayStats = useMemo(() => ({
    present: dayRows.filter((row) => row.record?.inAt).length,
    late: dayRows.filter((row) => row.record?.status === 'late').length,
    missing: dayRows.filter((row) => !row.record || (!row.record.inAt && !row.record.outAt)).length,
  }), [dayRows]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <GwHead icon="⏱️" name="근태" />

      <GwSplit
        nav={(
          <GwSideNav
            title="근태"
            desc="하루 전체 또는 직원별로 조회합니다."
            items={[
              { id: DAY_VIEW, icon: '📅', label: '일별 현황', hint: '하루치를 전 직원으로 봅니다.' },
              ...employees.map((row) => ({
                id: String(row.empId),
                icon: row.active ? '🙂' : '👋',
                label: row.active ? row.name : `${row.name} (퇴사)`,
              })),
            ]}
            activeId={view}
            onSelect={setView}
          />
        )}
      >
        <section className="rounded-xl border border-border bg-panel shadow-sm">
          {view === DAY_VIEW ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <button type="button" onClick={() => setDate((value) => moveDay(value, -1))} aria-label="이전 날" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">‹</button>
                <Button size="sm" onClick={() => setDate(today())}>오늘</Button>
                <button type="button" onClick={() => setDate((value) => moveDay(value, 1))} aria-label="다음 날" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">›</button>
                <h2 className="ml-1 text-[14px] font-extrabold text-ink">{dayTitle(date)}</h2>
                {/* 날짜를 직접 고르는 편이 화살표보다 빠른 경우가 많다(지난달 특정일 확인 등). */}
                <input
                  type="date"
                  value={date}
                  onChange={(event) => event.target.value && setDate(event.target.value)}
                  className="h-8 rounded-lg border border-border bg-panel px-2 text-[11px] text-ink2 outline-none"
                />
                <div className="ml-auto flex gap-1.5">
                  <Chip tone="bg-teal/15 text-teal">출근 {dayStats.present}명</Chip>
                  <Chip tone="bg-amber/15 text-amber">지각 {dayStats.late}명</Chip>
                  <Chip tone="bg-red-500/12 text-red-500">기록 없음 {dayStats.missing}명</Chip>
                </div>
              </div>

              {dayQuery.isLoading ? (
                <div className="grid min-h-64 place-items-center text-[11px] text-ink3">근태를 불러오는 중…</div>
              ) : dayRows.length === 0 ? (
                <div className="grid min-h-64 place-items-center text-[11px] text-ink3">재직 중인 직원이 없습니다.</div>
              ) : (
                <div className="overflow-x-auto p-2">
                  <table className="w-full border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-border text-[10px] font-bold text-ink2">
                        <th className="p-2">직원</th><th className="p-2">출근</th><th className="p-2">퇴근</th>
                        <th className="p-2">기본</th><th className="p-2">연장</th><th className="p-2">지각</th>
                        <th className="p-2">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayRows.map(({ employee, record }) => (
                        <tr key={employee.empId} className="border-b border-border/60 text-ink">
                          <td className="p-2 font-semibold">
                            <button type="button" onClick={() => { setView(String(employee.empId)); setMonth(date.slice(0, 7)); }} title="이 직원의 월별 기록 보기" className="hover:text-teal hover:underline">
                              {employee.name}
                            </button>
                          </td>
                          <td className="p-2">{timeOf(record?.inAt ?? null)}</td>
                          <td className="p-2">{timeOf(record?.outAt ?? null)}</td>
                          <td className="p-2 text-ink2">{hourText(record?.basicMin ?? 0)}</td>
                          <td className="p-2 text-ink2">{hourText(record?.overMin ?? 0)}</td>
                          <td className="p-2 text-ink2">{record && record.lateMin > 0 ? `${record.lateMin}분` : '—'}</td>
                          <td className="p-2">
                            {record ? <StatusBadge status={record.status} /> : <span className="text-[9.5px] text-ink3">기록 없음</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-2 pt-2 text-[9.5px] text-ink3">{NOTE}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <button type="button" onClick={() => setMonth((value) => moveMonth(value, -1))} aria-label="이전 달" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">‹</button>
                <Button size="sm" onClick={() => setMonth(thisMonth())}>이번 달</Button>
                <button type="button" onClick={() => setMonth((value) => moveMonth(value, 1))} aria-label="다음 달" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt">›</button>
                <h2 className="ml-1 text-[14px] font-extrabold text-ink">
                  {month.replace('-', '년 ')}월 · {selected?.name ?? '직원 선택'}
                </h2>
                <div className="ml-auto flex gap-1.5">
                  <Chip tone="bg-teal/15 text-teal">근무 {summary.workDays}일</Chip>
                  <Chip tone="bg-amber/15 text-amber">지각 {summary.lateDays}회</Chip>
                  <Chip tone="bg-red-500/12 text-red-500">결근 {summary.absentDays}일</Chip>
                  <Chip tone="bg-ink3/12 text-ink2">연장 {hourText(summary.overMinTotal)}</Chip>
                </div>
              </div>

              {monthQuery.isLoading ? (
                <div className="grid min-h-64 place-items-center text-[11px] text-ink3">근태를 불러오는 중…</div>
              ) : monthRows.length === 0 ? (
                <div className="grid min-h-64 place-items-center text-[11px] text-ink3">이 달의 기록이 없습니다.</div>
              ) : (
                <div className="overflow-x-auto p-2">
                  <table className="w-full border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-border text-[10px] font-bold text-ink2">
                        <th className="p-2">날짜</th><th className="p-2">출근</th><th className="p-2">퇴근</th>
                        <th className="p-2">기본</th><th className="p-2">연장</th><th className="p-2">지각</th>
                        <th className="p-2">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthRows.map((row: CommuteRecord) => (
                        <tr key={row.date} className="border-b border-border/60 text-ink">
                          <td className="p-2 font-semibold">
                            {/* 날짜를 누르면 그날 전 직원으로 건너간다 — 개인 → 하루 방향 이동. */}
                            <button type="button" onClick={() => { setDate(row.date); setView(DAY_VIEW); }} title="이 날짜의 전 직원 보기" className="hover:text-teal hover:underline">
                              {row.date.slice(5).replace('-', '/')}
                            </button>
                          </td>
                          <td className="p-2">{timeOf(row.inAt)}</td>
                          <td className="p-2">{timeOf(row.outAt)}</td>
                          <td className="p-2 text-ink2">{hourText(row.basicMin)}</td>
                          <td className="p-2 text-ink2">{hourText(row.overMin)}</td>
                          <td className="p-2 text-ink2">{row.lateMin > 0 ? `${row.lateMin}분` : '—'}</td>
                          <td className="p-2"><StatusBadge status={row.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-2 pt-2 text-[9.5px] text-ink3">{NOTE}</p>
                </div>
              )}
            </>
          )}
        </section>
      </GwSplit>
    </div>
  );
}
