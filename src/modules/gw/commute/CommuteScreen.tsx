import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  COMMUTE_STATUS_LABELS,
  summarizeCommuteMonth,
  type CommuteEmployee,
  type CommuteRecord,
} from '@/domain/commute/schema';
import { COMMUTE_STATUS_TONES } from '@/data/commute/commute.fixture';
import {
  useCommuteDay,
  useCommuteEmployees,
  useCommuteMonth,
  useCommuteMonthAll,
} from '@/features/commute/useCommute';
import { GwHead, GwSideNav, GwSplit } from '@/modules/gw/_gw';
import { Button } from '@/shared/ui/Button';

/**
 * 근태 조회 — CAPS 연동 데이터의 읽기 화면.
 *
 * 보는 방향이 셋이다. **일별**은 하루를 전 직원으로(오늘 누가 안 왔나), **월별**은 한 달을
 * 전 직원 집계로(이번 달 누가 많이 빠졌나), **직원별**은 한 사람의 한 달을 날짜별로 본다.
 * 전환은 화면 머리의 토글이 맡는다 — 좌측 직원 목록에 섞으면 성격이 다른 항목이 같은 줄에 선다.
 *
 * 데이터는 읽기 전용이다. 쓰기는 CAPS 인제스트(서버 전용 키)만 한다. status는 계약상
 * 추정 매핑이라 참고용 안내를 함께 둔다.
 */
const DAY_VIEW = 'day';
const MONTH_VIEW = 'month';

/**
 * 근태 대상이 아닌 등록명.
 *
 * CAPS `employees`에는 직위·구분 코드가 없다(사번·이름·재직·퇴사일이 전부). 대표·부대표는
 * 출퇴근 집계 대상이 아닌데 이름만으로는 가릴 근거가 없어 여기 적어 둔다. 원본에 구분 값이
 * 생기면 이 목록을 지우고 그 값으로 거를 것.
 */
const NON_ATTENDANCE_NAMES = new Set(['위원장님', '부위원장님']);

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
const monthTitle = (month: string): string => `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;

const timeOf = (iso: string | null): string => {
  if (!iso) return '—';
  const at = new Date(iso);
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

const hourText = (min: number): string => (min === 0 ? '—' : `${Math.floor(min / 60)}h ${min % 60}m`);

/**
 * 상단 집계 카드.
 *
 * 표 안의 작은 배지로 두면 숫자를 찾아야 한다. 화면을 열자마자 눈에 들어와야 하는 값이라
 * 표 위에 카드로 분리했다. `tone`은 강조할 카드에만 준다 — 전부 색을 넣으면 아무것도 안 띈다.
 */
function StatCard({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: string }) {
  return (
    <div className={`min-w-0 flex-1 rounded-xl border px-4 py-3 ${tone ?? 'border-border bg-panel'}`}>
      <div className="text-[10px] font-bold text-ink3">{label}</div>
      <div className="mt-1 truncate text-[19px] font-extrabold leading-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[10px] text-ink3">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: CommuteRecord['status'] }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${COMMUTE_STATUS_TONES[status]}`}>
      {COMMUTE_STATUS_LABELS[status]}
    </span>
  );
}

const NOTE = '상태 분류는 CAPS 원본 코드의 추정 매핑입니다. 확정 전에는 참고용으로만 보세요.';
const HEAD = 'p-2';

const navButton = 'grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt';
const searchInput = 'h-8 rounded-lg border border-border bg-panel px-2.5 text-[11px] text-ink outline-none placeholder:text-ink3';

export default function CommuteScreen() {
  const employeesQuery = useCommuteEmployees();
  const allEmployees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  // 근태 대상이 아닌 등록명은 어느 화면에서도 세지 않는다. 집계까지 흔들린다.
  const employees = useMemo(
    () => allEmployees.filter((row) => !NON_ATTENDANCE_NAMES.has(row.name.trim())),
    [allEmployees],
  );

  /** 보기 대상. `day`·`month`면 전 직원, 숫자면 그 사번의 월별. */
  const [view, setView] = useState<string>(DAY_VIEW);
  const [month, setMonth] = useState(thisMonth());
  const [date, setDate] = useState(today());
  /** 이름 검색·퇴사자 표시. 세 화면이 같은 값을 쓴다 — 보기를 바꿨다고 다시 칠 이유가 없다. */
  const [keyword, setKeyword] = useState('');
  const [showRetired, setShowRetired] = useState(false);

  const isEmployeeView = view !== DAY_VIEW && view !== MONTH_VIEW;
  const empId = isEmployeeView ? Number(view) : null;
  const firstEmpId = (employees.find((row) => row.active) ?? employees[0])?.empId;

  useEffect(() => {
    if (isEmployeeView && Number.isNaN(Number(view)) && firstEmpId !== undefined) setView(String(firstEmpId));
  }, [firstEmpId, isEmployeeView, view]);

  const monthQuery = useCommuteMonth(empId, month);
  const dayQuery = useCommuteDay(view === DAY_VIEW ? date : null);
  const monthAllQuery = useCommuteMonthAll(view === MONTH_VIEW ? month : null);

  const monthRows = useMemo(() => monthQuery.data ?? [], [monthQuery.data]);
  const summary = useMemo(() => summarizeCommuteMonth(monthRows), [monthRows]);
  const selected = employees.find((row) => row.empId === empId);

  const matches = (employee: CommuteEmployee) => {
    const text = keyword.trim();
    if (text !== '' && !employee.name.includes(text) && !String(employee.empId).includes(text)) return false;
    return showRetired || employee.active;
  };

  const visible = useMemo(
    () => employees.filter(matches).sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [employees, keyword, showRetired],
  );

  /** 일별 표 — 기록 없는 직원도 한 줄로 남긴다. 빠진 사람이 안 보이면 쓸모가 없다. */
  const dayRows = useMemo(() => {
    const byEmp = new Map<number, CommuteRecord>();
    for (const row of dayQuery.data ?? []) byEmp.set(row.empId, row);
    return visible.map((employee) => ({ employee, record: byEmp.get(employee.empId) ?? null }));
  }, [dayQuery.data, visible]);

  const dayStats = useMemo(() => ({
    present: dayRows.filter((row) => row.record?.inAt).length,
    late: dayRows.filter((row) => row.record?.status === 'late').length,
    missing: dayRows.filter((row) => !row.record || (!row.record.inAt && !row.record.outAt)).length,
  }), [dayRows]);

  /** 월별 집계 — 사람별로 묶어 도메인 요약을 그대로 쓴다. */
  const monthAllRows = useMemo(() => {
    const byEmp = new Map<number, CommuteRecord[]>();
    for (const row of monthAllQuery.data ?? []) {
      const list = byEmp.get(row.empId);
      if (list) list.push(row); else byEmp.set(row.empId, [row]);
    }
    return visible.map((employee) => ({
      employee,
      summary: summarizeCommuteMonth(byEmp.get(employee.empId) ?? []),
    }));
  }, [monthAllQuery.data, visible]);

  const monthTotals = useMemo(() => ({
    workDays: monthAllRows.reduce((sum, row) => sum + row.summary.workDays, 0),
    late: monthAllRows.reduce((sum, row) => sum + row.summary.lateDays, 0),
    absent: monthAllRows.reduce((sum, row) => sum + row.summary.absentDays, 0),
    over: monthAllRows.reduce((sum, row) => sum + row.summary.overMinTotal, 0),
  }), [monthAllRows]);

  const modeButton = (id: string, label: string, active: boolean) => (
    <button
      key={id}
      type="button"
      onClick={() => {
        if (id === DAY_VIEW || id === MONTH_VIEW) setView(id);
        else if (firstEmpId !== undefined) setView(String(firstEmpId));
      }}
      className={`rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
        active ? 'bg-teal text-white' : 'text-ink3 hover:text-ink2'
      }`}
    >
      {label}
    </button>
  );

  const modeToggle = (
    <div className="flex items-center gap-0.5 self-center rounded-lg border border-border bg-panel p-0.5">
      {modeButton(DAY_VIEW, '일별', view === DAY_VIEW)}
      {modeButton(MONTH_VIEW, '월별', view === MONTH_VIEW)}
      {modeButton('employee', '직원별', isEmployeeView)}
    </div>
  );

  const searchBox = (
    <input
      value={keyword}
      onChange={(event) => setKeyword(event.target.value)}
      placeholder="이름·사번 검색"
      className={`${searchInput} w-40`}
    />
  );

  const tableNote = <p className="px-2 pt-2 text-[9.5px] text-ink3">{NOTE}</p>;

  const dayPanel = (
    <>
      <div className="flex flex-wrap gap-2">
        <StatCard label="재직 인원" value={`${dayRows.length}명`} sub={keyword.trim() ? '검색 결과 기준' : undefined} />
        <StatCard label="출근" value={`${dayStats.present}명`} tone="border-teal/25 bg-teal/8" />
        <StatCard label="지각" value={`${dayStats.late}명`} tone="border-amber/25 bg-amber/8" />
        <StatCard label="기록 없음" value={`${dayStats.missing}명`} tone="border-red-500/20 bg-red-500/6" />
      </div>

      <section className="mt-3 rounded-xl border border-border bg-panel shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <button type="button" onClick={() => setDate((value) => moveDay(value, -1))} aria-label="이전 날" className={navButton}>‹</button>
          <Button size="sm" onClick={() => setDate(today())}>오늘</Button>
          <button type="button" onClick={() => setDate((value) => moveDay(value, 1))} aria-label="다음 날" className={navButton}>›</button>
          <h2 className="ml-1 text-[14px] font-extrabold text-ink">{dayTitle(date)}</h2>
          {/* 날짜를 직접 고르는 편이 화살표보다 빠른 경우가 많다(지난달 특정일 확인 등). */}
          <input type="date" value={date} onChange={(event) => event.target.value && setDate(event.target.value)} className={`${searchInput} text-ink2`} />
          <div className="ml-auto">{searchBox}</div>
        </div>

        {dayQuery.isLoading ? (
          <div className="grid min-h-64 place-items-center text-[11px] text-ink3">근태를 불러오는 중…</div>
        ) : dayRows.length === 0 ? (
          <div className="grid min-h-64 place-items-center text-[11px] text-ink3">조건에 맞는 직원이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto p-2">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold text-ink2">
                  <th className={HEAD}>직원</th><th className={HEAD}>출근</th><th className={HEAD}>퇴근</th>
                  <th className={HEAD}>기본</th><th className={HEAD}>연장</th><th className={HEAD}>지각</th><th className={HEAD}>상태</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map(({ employee, record }) => (
                  <tr key={employee.empId} className="border-b border-border/60 text-ink">
                    <td className="p-2 font-semibold">
                      {/* 이름 → 그 사람의 월별. 하루에서 사람으로 파고드는 방향. */}
                      <button type="button" onClick={() => { setMonth(date.slice(0, 7)); setView(String(employee.empId)); }} title="이 직원의 월별 기록 보기" className="hover:text-teal hover:underline">
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
            {tableNote}
          </div>
        )}
      </section>
    </>
  );

  const monthAllPanel = (
    <>
      <div className="flex flex-wrap gap-2">
        <StatCard label="대상 인원" value={`${monthAllRows.length}명`} sub={monthTitle(month)} />
        <StatCard label="근무일 합계" value={`${monthTotals.workDays}일`} tone="border-teal/25 bg-teal/8" />
        <StatCard label="지각" value={`${monthTotals.late}회`} tone="border-amber/25 bg-amber/8" />
        <StatCard label="결근" value={`${monthTotals.absent}일`} tone="border-red-500/20 bg-red-500/6" />
        <StatCard label="연장 합계" value={hourText(monthTotals.over)} />
      </div>

      <section className="mt-3 rounded-xl border border-border bg-panel shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <button type="button" onClick={() => setMonth((value) => moveMonth(value, -1))} aria-label="이전 달" className={navButton}>‹</button>
          <Button size="sm" onClick={() => setMonth(thisMonth())}>이번 달</Button>
          <button type="button" onClick={() => setMonth((value) => moveMonth(value, 1))} aria-label="다음 달" className={navButton}>›</button>
          <h2 className="ml-1 text-[14px] font-extrabold text-ink">{monthTitle(month)} · 전 직원</h2>
          <div className="ml-auto">{searchBox}</div>
        </div>

        {monthAllQuery.isLoading ? (
          <div className="grid min-h-64 place-items-center text-[11px] text-ink3">근태를 불러오는 중…</div>
        ) : monthAllRows.length === 0 ? (
          <div className="grid min-h-64 place-items-center text-[11px] text-ink3">조건에 맞는 직원이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto p-2">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold text-ink2">
                  <th className={HEAD}>직원</th><th className={HEAD}>근무</th><th className={HEAD}>지각</th>
                  <th className={HEAD}>결근</th><th className={HEAD}>연장</th>
                </tr>
              </thead>
              <tbody>
                {monthAllRows.map(({ employee, summary: row }) => (
                  <tr key={employee.empId} className="border-b border-border/60 text-ink">
                    <td className="p-2 font-semibold">
                      <button type="button" onClick={() => setView(String(employee.empId))} title="이 직원의 날짜별 기록 보기" className="hover:text-teal hover:underline">
                        {employee.active ? employee.name : `${employee.name} (퇴사)`}
                      </button>
                    </td>
                    <td className="p-2 text-ink2">{row.workDays}일</td>
                    {/* 0은 흐리게 둔다. 눈이 0이 아닌 값에 먼저 가야 한다. */}
                    <td className={`p-2 ${row.lateDays > 0 ? 'font-bold text-amber' : 'text-ink3'}`}>{row.lateDays}회</td>
                    <td className={`p-2 ${row.absentDays > 0 ? 'font-bold text-red-500' : 'text-ink3'}`}>{row.absentDays}일</td>
                    <td className="p-2 text-ink2">{hourText(row.overMinTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tableNote}
          </div>
        )}
      </section>
    </>
  );

  const monthPanel = (
    <>
      <div className="flex flex-wrap gap-2">
        <StatCard label="근무" value={`${summary.workDays}일`} sub={selected?.name ?? '직원 선택'} tone="border-teal/25 bg-teal/8" />
        <StatCard label="지각" value={`${summary.lateDays}회`} tone="border-amber/25 bg-amber/8" />
        <StatCard label="결근" value={`${summary.absentDays}일`} tone="border-red-500/20 bg-red-500/6" />
        <StatCard label="연장" value={hourText(summary.overMinTotal)} />
      </div>

      <section className="mt-3 rounded-xl border border-border bg-panel shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <button type="button" onClick={() => setMonth((value) => moveMonth(value, -1))} aria-label="이전 달" className={navButton}>‹</button>
          <Button size="sm" onClick={() => setMonth(thisMonth())}>이번 달</Button>
          <button type="button" onClick={() => setMonth((value) => moveMonth(value, 1))} aria-label="다음 달" className={navButton}>›</button>
          <h2 className="ml-1 text-[14px] font-extrabold text-ink">{monthTitle(month)} · {selected?.name ?? '직원 선택'}</h2>
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
                  <th className={HEAD}>날짜</th><th className={HEAD}>출근</th><th className={HEAD}>퇴근</th>
                  <th className={HEAD}>기본</th><th className={HEAD}>연장</th><th className={HEAD}>지각</th><th className={HEAD}>상태</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((row: CommuteRecord) => (
                  <tr key={row.date} className="border-b border-border/60 text-ink">
                    <td className="p-2 font-semibold">
                      {/* 날짜 → 그날 전 직원. 사람에서 하루로 나오는 방향. */}
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
            {tableNote}
          </div>
        )}
      </section>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <GwHead icon="⏱️" name="근태" right={modeToggle} />

      {isEmployeeView ? (
        <GwSplit
          nav={(
            <GwSideNav
              title="직원"
              desc={`${visible.length}명 / 전체 ${employees.length}명`}
              scrollItems
              filter={(
                <div className="flex flex-col gap-2">
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="이름·사번 검색" className={`${searchInput} w-full`} />
                  <label className="flex cursor-pointer items-center gap-1.5 text-[10.5px] text-ink3">
                    <input type="checkbox" checked={showRetired} onChange={(event) => setShowRetired(event.target.checked)} className="h-3 w-3 accent-teal" />
                    퇴사자 포함
                  </label>
                </div>
              )}
              items={visible.map((row) => ({
                id: String(row.empId),
                label: row.active ? row.name : `${row.name} (퇴사)`,
              }))}
              activeId={view}
              onSelect={setView}
            />
          )}
        >
          {monthPanel}
        </GwSplit>
      ) : (
        <div className="mt-5">{view === DAY_VIEW ? dayPanel : monthAllPanel}</div>
      )}
    </div>
  );
}
