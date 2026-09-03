import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  COMMUTE_STATUS_LABELS,
  canSeeOthers,
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
  useCommuteViewer,
} from '@/features/commute/useCommute';
import { useAuth } from '@/app/auth/AuthProvider';
import { usePermission } from '@/features/auth/usePermission';
import { resolveUserScope } from '@/features/auth/scopeHelper';
import { GwHead, GwSideNav, GwSplit } from '@/modules/gw/_gw';
import { Button } from '@/shared/ui/Button';

/**
 * 근태 조회 — CAPS 연동 데이터의 읽기 화면.
 *
 * **자리에 따라 화면이 다르다.** 누구나 자기 근태는 보고(`내 근태`), 남의 근태를 볼 수 있는
 * 사람에게만 `부서원 근태`가 열린다 — 관리자는 전 직원, 부서장은 자기 부서원까지. 그 판정은
 * **서버(`caps-ingest`)가 한다.** 화면은 `viewerScope`가 알려준 결과로 탭 노출과 범위 표기만
 * 정한다. 같은 규칙을 화면에도 두면 언젠가 한쪽만 바뀌어 어긋나고, 화면이 숨기는 것과 서버가
 * 막는 것이 갈라지면 그때부터는 화면을 믿을 수 없다.
 *
 * 부서원 근태는 보는 방향이 셋이다. **일별**은 하루를 전원으로(오늘 누가 안 왔나), **월별**은
 * 한 달을 전원 집계로(이번 달 누가 많이 빠졌나), **직원별**은 한 사람의 한 달을 날짜별로 본다.
 *
 * 데이터는 읽기 전용이다. 쓰기는 CAPS 인제스트(서버 전용 키)만 한다. status는 계약상
 * 추정 매핑이라 참고용 안내를 함께 둔다.
 */
const DAY_VIEW = 'day';
const MONTH_VIEW = 'month';
const ME_TAB = 'me';
const TEAM_TAB = 'team';

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
  const { user } = useAuth();
  const { userRoles } = usePermission();
  const userScope = useMemo(() => resolveUserScope(user, userRoles), [user, userRoles]);

  const viewerQuery = useCommuteViewer();
  const viewer = viewerQuery.data;
  /** 부서원/전사 탭을 열 수 있는 자리인지. EXEC(임원) 및 팀장급 이상 또는 viewer 권한 보유자. */
  const canTeam = userScope === 'COMPANY' || userScope === 'LEADER' || canSeeOthers(viewer);
  const employeesQuery = useCommuteEmployees();
  const allEmployees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  // 근태 대상이 아닌 등록명은 어느 화면에서도 세지 않는다. 집계까지 흔들린다.
  const employees = useMemo(
    () => allEmployees.filter((row) => !NON_ATTENDANCE_NAMES.has(row.name.trim())),
    [allEmployees],
  );

  /** 내 근태 / 부서원 근태. 볼 수 없는 자리면 아래에서 내 근태로 되돌린다. */
  const [tab, setTab] = useState<string>(ME_TAB);
  /** 부서원 탭 안의 보기. `day`·`month`면 전원, 숫자면 그 사번의 월별. */
  const [view, setView] = useState<string>(DAY_VIEW);
  const [month, setMonth] = useState(thisMonth());
  const [date, setDate] = useState(today());
  /** 이름 검색·퇴사자 표시. 세 화면이 같은 값을 쓴다 — 보기를 바꿨다고 다시 칠 이유가 없다. */
  const [keyword, setKeyword] = useState('');
  const [showRetired, setShowRetired] = useState(false);

  /*
    권한이 없으면 상태와 무관하게 내 근태로 고정한다. 상태를 되돌리는 effect를 쓰면 권한을
    아직 모르는 첫 렌더에 한 번 깜빡인다 — 그릴 때 계산하면 그 틈이 없다.
  */
  const activeTab = canTeam ? tab : ME_TAB;
  const isTeam = activeTab === TEAM_TAB;

  const isEmployeeView = view !== DAY_VIEW && view !== MONTH_VIEW;
  const teamEmpId = isEmployeeView ? Number(view) : null;
  /** 월별 표가 볼 사번. 내 탭이면 나, 부서원 탭이면 고른 직원. */
  const monthEmpId = activeTab === ME_TAB ? (viewer?.empId ?? null) : teamEmpId;
  const firstEmpId = (employees.find((row) => row.active) ?? employees[0])?.empId;

  useEffect(() => {
    if (isEmployeeView && Number.isNaN(Number(view)) && firstEmpId !== undefined) setView(String(firstEmpId));
  }, [firstEmpId, isEmployeeView, view]);

  const monthQuery = useCommuteMonth(monthEmpId, month);
  const dayQuery = useCommuteDay(isTeam && view === DAY_VIEW ? date : null);
  const monthAllQuery = useCommuteMonthAll(isTeam && view === MONTH_VIEW ? month : null);

  const monthRows = useMemo(() => monthQuery.data ?? [], [monthQuery.data]);
  const summary = useMemo(() => summarizeCommuteMonth(monthRows), [monthRows]);
  const selected = employees.find((row) => row.empId === teamEmpId);

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

  const toggleButton = (key: string, label: string, active: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
        active ? 'bg-teal text-white' : 'text-ink3 hover:text-ink2'
      }`}
    >
      {label}
    </button>
  );

  const toggleShell = 'flex items-center gap-0.5 self-center rounded-lg border border-border bg-panel p-0.5';

  /** 1차 전환. 부서원/전사 탭은 볼 수 있는 사람에게만 보인다 — 없는 권한을 눌러 보게 두지 않는다. */
  const tabToggle = (
    <div className={toggleShell}>
      {toggleButton(ME_TAB, '내 근태', activeTab === ME_TAB, () => setTab(ME_TAB))}
      {canTeam && toggleButton(TEAM_TAB, userScope === 'COMPANY' ? '전사 근태' : '부서원 근태', isTeam, () => setTab(TEAM_TAB))}
    </div>
  );

  /** 2차 전환 — 부서원 탭 안에서만 쓴다. */
  const modeToggle = (
    <div className={toggleShell}>
      {toggleButton(DAY_VIEW, '일별', view === DAY_VIEW, () => setView(DAY_VIEW))}
      {toggleButton(MONTH_VIEW, '월별', view === MONTH_VIEW, () => setView(MONTH_VIEW))}
      {toggleButton('employee', '직원별', isEmployeeView, () => { if (firstEmpId !== undefined) setView(String(firstEmpId)); })}
    </div>
  );

  /** 부서원 탭이 지금 덮는 범위. 임원은 전 직원, 팀장/부서장은 본인 부서다. */
  const scopeLabel = userScope === 'COMPANY' ? '전사 전 임직원' : (user?.dept ? `${user.dept} 소속` : (viewer?.deptNames.join(' · ') || '내 부서'));

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
          <h2 className="ml-1 text-[14px] font-extrabold text-ink">{monthTitle(month)} · {scopeLabel}</h2>
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

  /**
   * 한 사람의 한 달. 내 탭과 부서원>직원별이 같은 표를 쓴다 — 보는 사람만 다르지 표는 같다.
   * `canDrillToDay`는 내 탭에서 끈다. 그 날 전원 보기는 부서원 탭의 권한이라 내 탭에서
   * 열리면 안 된다.
   */
  const renderMonthPanel = (ownerName: string, canDrillToDay: boolean) => (
    <>
      <div className="flex flex-wrap gap-2">
        <StatCard label="근무" value={`${summary.workDays}일`} sub={ownerName} tone="border-teal/25 bg-teal/8" />
        <StatCard label="지각" value={`${summary.lateDays}회`} tone="border-amber/25 bg-amber/8" />
        <StatCard label="결근" value={`${summary.absentDays}일`} tone="border-red-500/20 bg-red-500/6" />
        <StatCard label="연장" value={hourText(summary.overMinTotal)} />
      </div>

      <section className="mt-3 rounded-xl border border-border bg-panel shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <button type="button" onClick={() => setMonth((value) => moveMonth(value, -1))} aria-label="이전 달" className={navButton}>‹</button>
          <Button size="sm" onClick={() => setMonth(thisMonth())}>이번 달</Button>
          <button type="button" onClick={() => setMonth((value) => moveMonth(value, 1))} aria-label="다음 달" className={navButton}>›</button>
          <h2 className="ml-1 text-[14px] font-extrabold text-ink">{monthTitle(month)} · {ownerName}</h2>
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
                      {/* 날짜 → 그날 전원. 사람에서 하루로 나오는 방향(부서원 탭에서만). */}
                      {canDrillToDay ? (
                        <button type="button" onClick={() => { setDate(row.date); setView(DAY_VIEW); }} title="이 날짜의 전원 보기" className="hover:text-teal hover:underline">
                          {row.date.slice(5).replace('-', '/')}
                        </button>
                      ) : row.date.slice(5).replace('-', '/')}
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

  /** 내 근태. CAPS 등록명과 이름이 안 맞으면 사번을 못 찾는다 — 왜 비었는지 밝힌다. */
  const mePanel = viewer?.empId === null || viewer?.empId === undefined ? (
    <div className="rounded-xl border border-dashed border-border bg-panel px-6 py-12 text-center">
      <div className="text-2xl">🪪</div>
      <div className="mt-2 text-[12px] font-bold text-ink">근태 시스템에서 내 기록을 찾지 못했습니다.</div>
      <div className="mt-1 text-[10.5px] leading-relaxed text-ink3">
        그룹웨어 이름{viewer?.name ? ` ‘${viewer.name}’` : ''}과 근태 단말에 등록된 이름이 다르면 연결되지 않습니다.
        <br />관리자에게 근태 등록명 확인을 요청하세요.
      </div>
    </div>
  ) : renderMonthPanel(viewer.name || '내 근태', false);

  const teamPanel = isEmployeeView ? (
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
      {renderMonthPanel(selected?.name ?? '직원 선택', true)}
    </GwSplit>
  ) : (
    <div className="mt-5">{view === DAY_VIEW ? dayPanel : monthAllPanel}</div>
  );

  /*
    권한을 모르는 동안에는 아무 탭도 그리지 않는다. 먼저 내 근태를 그려 두면 관리자에게는
    화면이 한 번 접혔다 펴지고, 조회가 실패한 것인지 권한이 없는 것인지도 구분되지 않는다.
  */
  if (viewerQuery.isLoading) {
    return <div className="grid min-h-[60vh] place-items-center text-[12px] font-semibold text-ink3">근태 권한을 확인하는 중…</div>;
  }
  if (viewerQuery.isError) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-5 text-center text-[12px] font-semibold text-danger">
        근태 열람 권한을 확인하지 못했습니다.
        <br />
        <span className="mt-1 block text-[10.5px] font-semibold text-ink3">
          {viewerQuery.error instanceof Error ? viewerQuery.error.message : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <GwHead icon="⏱️" name="근태" right={tabToggle} />

      {isTeam ? (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {modeToggle}
            <span className="text-[10.5px] font-semibold text-ink3">열람 범위 · {scopeLabel}</span>
          </div>
          {teamPanel}
        </>
      ) : (
        <div className="mt-5">{mePanel}</div>
      )}
    </div>
  );
}
