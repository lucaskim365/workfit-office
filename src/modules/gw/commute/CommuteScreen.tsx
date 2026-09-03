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
import { useCommutePolicy } from '@/features/commute/useCommutePolicy';
import { DEFAULT_COMMUTE_POLICY } from '@/domain/commutePolicy/schema';
import {
  evaluateCommuteRecord,
  getKoreanHoliday,
  isWeekend,
  type ApprovedLeaveInfo,
} from '@/domain/commute/engine';
import { useAllApprovals } from '@/features/gw/useApprovals';
import { CommutePolicyModal } from './components/CommutePolicyModal';
import { Settings, Clock, Calendar as CalendarIcon, List, Info } from 'lucide-react';

/**
 * 근태 조회 — CAPS 연동 데이터 및 승인 휴가/공휴일 연동 화면.
 */
const DAY_VIEW = 'day';
const MONTH_VIEW = 'month';
const ME_TAB = 'me';
const TEAM_TAB = 'team';

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

function StatCard({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: string }) {
  return (
    <div className={`min-w-0 flex-1 rounded-xl border px-4 py-3 shadow-2xs transition-all ${tone ?? 'border-border bg-panel'}`}>
      <div className="text-[10px] font-bold text-ink3">{label}</div>
      <div className="mt-1 truncate text-[19px] font-extrabold leading-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[10px] text-ink3">{sub}</div>}
    </div>
  );
}

function StatusBadge({ record }: { record: CommuteRecord }) {
  const { status, leaveName, holidayName } = record;

  if (status === 'unknown') {
    return <span className="text-[10px] text-ink3/70 font-medium">—</span>;
  }

  if (status === 'leave') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 border border-emerald-500/25 shadow-2xs">
        <span>🏖️</span>
        <span>{leaveName || '휴가'}</span>
      </span>
    );
  }

  if (status === 'off' && holidayName && holidayName !== '주말 휴무') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[9.5px] font-bold text-rose-500 border border-rose-500/20">
        <span>●</span>
        <span>{holidayName}</span>
      </span>
    );
  }

  return (
    <span className={`rounded-md px-2 py-0.5 text-[9.5px] font-bold ${COMMUTE_STATUS_TONES[status]}`}>
      {COMMUTE_STATUS_LABELS[status]}
    </span>
  );
}

const NOTE = '상태 분류는 CAPS 원본 태그 및 전자결재 승인 휴가/법정 공휴일을 종합 판정한 실시간 근태 현황입니다.';
const HEAD = 'p-2.5';

const navButton = 'grid h-8 w-8 place-items-center rounded-lg border border-border text-ink2 hover:bg-panel-alt transition-colors';
const searchInput = 'h-8 rounded-lg border border-border bg-panel px-2.5 text-[11px] text-ink outline-none placeholder:text-ink3';

export default function CommuteScreen() {
  const { user } = useAuth();
  const { userRoles, isAdmin } = usePermission();
  const { policy = DEFAULT_COMMUTE_POLICY, savePolicy } = useCommutePolicy();
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  const userScope = useMemo(() => resolveUserScope(user, userRoles), [user, userRoles]);
  const canManagePolicy = isAdmin || userScope === 'COMPANY';

  const viewerQuery = useCommuteViewer();
  const viewer = viewerQuery.data;
  const canTeam = userScope === 'COMPANY' || userScope === 'LEADER' || canSeeOthers(viewer);

  const employeesQuery = useCommuteEmployees();
  const allEmployees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const employees = useMemo(
    () => allEmployees.filter((row) => !NON_ATTENDANCE_NAMES.has(row.name.trim())),
    [allEmployees],
  );

  const [tab, setTab] = useState<string>(ME_TAB);
  const [view, setView] = useState<string>(DAY_VIEW);
  const [month, setMonth] = useState(thisMonth());
  const [date, setDate] = useState(today());
  const [keyword, setKeyword] = useState('');
  const [showRetired, setShowRetired] = useState(false);

  // 내 근태 보기 방식: 'calendar'(달력 그리드) vs 'table'(목록 표)
  const [displayMode, setDisplayMode] = useState<'calendar' | 'table'>('calendar');

  const activeTab = canTeam ? tab : ME_TAB;
  const isTeam = activeTab === TEAM_TAB;

  const isEmployeeView = view !== DAY_VIEW && view !== MONTH_VIEW;
  const teamEmpId = isEmployeeView ? Number(view) : null;
  const monthEmpId = activeTab === ME_TAB ? (viewer?.empId ?? null) : teamEmpId;
  const firstEmpId = (employees.find((row) => row.active) ?? employees[0])?.empId;

  const selected = employees.find((row) => row.empId === teamEmpId);

  useEffect(() => {
    if (isEmployeeView && Number.isNaN(Number(view)) && firstEmpId !== undefined) {
      setView(String(firstEmpId));
    }
  }, [firstEmpId, isEmployeeView, view]);

  const monthQuery = useCommuteMonth(monthEmpId, month);
  const dayQuery = useCommuteDay(isTeam && view === DAY_VIEW ? date : null);
  const monthAllQuery = useCommuteMonthAll(isTeam && view === MONTH_VIEW ? month : null);

  // 전자결재 승인 휴가 데이터 연동 (내 휴가 및 선택 직원 휴가)
  const approvalsQuery = useAllApprovals();
  const leaveMap = useMemo(() => {
    const map = new Map<string, ApprovedLeaveInfo>();
    const targetName = activeTab === ME_TAB ? (user?.name?.trim() ?? '') : (selected?.name?.trim() ?? '');
    const targetUserId = activeTab === ME_TAB ? user?.id : undefined;

    for (const doc of approvalsQuery.data ?? []) {
      if (doc.docType !== '휴가' || doc.status !== '완료' || !doc.form) continue;

      const drafterName = (doc.drafterName || '').trim();
      const matchName = targetName && drafterName === targetName;
      const matchId = targetUserId && doc.drafterId === targetUserId;

      if (!matchName && !matchId) continue;

      const start = doc.form.startDate;
      const end = doc.form.endDate || doc.form.startDate;
      if (!start) continue;

      let curr = new Date(start + 'T00:00:00');
      const last = new Date(end + 'T00:00:00');
      if (Number.isNaN(curr.getTime()) || Number.isNaN(last.getTime())) continue;

      while (curr <= last) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, '0');
        const dd = String(curr.getDate()).padStart(2, '0');
        const dateKey = `${yyyy}-${mm}-${dd}`;
        map.set(dateKey, {
          leaveType: doc.form.leaveType || '연차',
          docTitle: doc.title,
          docId: doc.id,
        });
        curr.setDate(curr.getDate() + 1);
      }
    }
    return map;
  }, [approvalsQuery.data, activeTab, user, selected]);

  // 한 달 전체 날짜(1일~말일)를 생성하여 공휴일, 승인 휴가, 출퇴근 기록을 완벽히 합성
  const monthRows = useMemo(() => {
    const rawMap = new Map<string, CommuteRecord>();
    for (const r of monthQuery.data ?? []) {
      rawMap.set(r.date, r);
    }

    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return [];

    const daysInMonth = new Date(y, m, 0).getDate();
    const records: CommuteRecord[] = [];

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${month}-${pad(dayNum)}`;
      const raw = rawMap.get(dateStr) ?? {
        empId: monthEmpId ?? 0,
        date: dateStr,
        inAt: null,
        outAt: null,
      };
      records.push(evaluateCommuteRecord(raw, policy, leaveMap));
    }
    return records;
  }, [monthQuery.data, month, monthEmpId, policy, leaveMap]);

  const summary = useMemo(() => summarizeCommuteMonth(monthRows), [monthRows]);

  const matches = (employee: CommuteEmployee) => {
    const text = keyword.trim();
    if (text !== '' && !employee.name.includes(text) && !String(employee.empId).includes(text)) return false;
    return showRetired || employee.active;
  };

  const visible = useMemo(
    () => employees.filter(matches).sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [employees, keyword, showRetired],
  );

  /** 일별 표 — 정책 및 휴가 반영 */
  const dayRows = useMemo(() => {
    const byEmp = new Map<number, CommuteRecord>();
    for (const row of dayQuery.data ?? []) {
      byEmp.set(row.empId, evaluateCommuteRecord(row, policy, leaveMap));
    }
    return visible.map((employee) => ({ employee, record: byEmp.get(employee.empId) ?? null }));
  }, [dayQuery.data, visible, policy, leaveMap]);

  const dayStats = useMemo(() => ({
    present: dayRows.filter((row) => row.record?.inAt).length,
    late: dayRows.filter((row) => row.record?.status === 'late').length,
    leave: dayRows.filter((row) => row.record?.status === 'leave').length,
    missing: dayRows.filter((row) => !row.record || (!row.record.inAt && !row.record.outAt && row.record.status !== 'leave' && row.record.status !== 'off')).length,
  }), [dayRows]);

  /** 월별 집계 — 정책 기반 동적 재계산 적용 */
  const monthAllRows = useMemo(() => {
    const byEmp = new Map<number, CommuteRecord[]>();
    for (const row of monthAllQuery.data ?? []) {
      const evaluated = evaluateCommuteRecord(row, policy, leaveMap);
      const list = byEmp.get(row.empId);
      if (list) list.push(evaluated);
      else byEmp.set(row.empId, [evaluated]);
    }
    return visible.map((employee) => ({
      employee,
      summary: summarizeCommuteMonth(byEmp.get(employee.empId) ?? []),
    }));
  }, [monthAllQuery.data, visible, policy, leaveMap]);

  const monthTotals = useMemo(() => ({
    workDays: monthAllRows.reduce((sum, row) => sum + row.summary.workDays, 0),
    late: monthAllRows.reduce((sum, row) => sum + row.summary.lateDays, 0),
    absent: monthAllRows.reduce((sum, row) => sum + row.summary.absentDays, 0),
    leave: monthAllRows.reduce((sum, row) => sum + row.summary.leaveDays, 0),
    over: monthAllRows.reduce((sum, row) => sum + row.summary.overMinTotal, 0),
  }), [monthAllRows]);

  const toggleButton = (key: string, label: string, active: boolean, onClick: () => void, icon?: ReactNode) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-bold transition-all ${
        active ? 'bg-teal text-white shadow-2xs' : 'text-ink3 hover:text-ink2 hover:bg-panel-alt/60'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  const toggleShell = 'flex items-center gap-0.5 self-center rounded-lg border border-border bg-panel p-0.5 shadow-2xs';

  const tabToggle = (
    <div className={toggleShell}>
      {toggleButton(ME_TAB, '내 근태', activeTab === ME_TAB, () => setTab(ME_TAB))}
      {canTeam && toggleButton(TEAM_TAB, userScope === 'COMPANY' ? '전사 근태' : '부서원 근태', isTeam, () => setTab(TEAM_TAB))}
    </div>
  );

  const modeToggle = (
    <div className={toggleShell}>
      {toggleButton(DAY_VIEW, '일별', view === DAY_VIEW, () => setView(DAY_VIEW))}
      {toggleButton(MONTH_VIEW, '월별', view === MONTH_VIEW, () => setView(MONTH_VIEW))}
      {toggleButton('employee', '직원별', isEmployeeView, () => {
        if (firstEmpId !== undefined) setView(String(firstEmpId));
      })}
    </div>
  );

  const scopeLabel = userScope === 'COMPANY' ? '전사 전 임직원' : (user?.dept ? `${user.dept} 소속` : (viewer?.deptNames.join(' · ') || '내 부서'));

  const searchBox = (
    <input
      value={keyword}
      onChange={(event) => setKeyword(event.target.value)}
      placeholder="이름·사번 검색"
      className={`${searchInput} w-40`}
    />
  );

  const tableNote = (
    <div className="flex items-center gap-1.5 px-3 pt-3 text-[10px] text-ink3">
      <Info size={12} className="text-teal shrink-0" />
      <span>{NOTE}</span>
    </div>
  );

  /** 캘린더 그리드 렌더러 */
  const renderCalendarGrid = (rows: CommuteRecord[]) => {
    if (rows.length === 0) return null;

    const [y, m] = month.split('-').map(Number);
    const firstDayOfWeek = new Date(y, m - 1, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const todayStr = today();

    return (
      <div className="p-3">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold pb-2 border-b border-border mb-1.5">
          <div className="text-rose-500">일 (Sun)</div>
          <div className="text-ink">월 (Mon)</div>
          <div className="text-ink">화 (Tue)</div>
          <div className="text-ink">수 (Wed)</div>
          <div className="text-ink">목 (Thu)</div>
          <div className="text-ink">금 (Fri)</div>
          <div className="text-blue-500">토 (Sat)</div>
        </div>

        {/* 달력 그리드 */}
        <div className="grid grid-cols-7 gap-1.5">
          {/* 이전 달 빈칸 패딩 */}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="min-h-[100px] rounded-lg border border-dashed border-border/40 bg-panel-alt/20" />
          ))}

          {/* 실제 날짜 셀 */}
          {rows.map((row) => {
            const dayNum = Number(row.date.slice(8));
            const d = new Date(row.date + 'T00:00:00');
            const dayOfWeek = d.getDay();
            const isSun = dayOfWeek === 0;
            const isSat = dayOfWeek === 6;
            const isToday = row.date === todayStr;
            const holiday = getKoreanHoliday(row.date);

            let cellBg = 'bg-panel border-border';
            if (row.status === 'leave') cellBg = 'bg-emerald-500/5 border-emerald-500/30';
            else if (holiday || isSun) cellBg = 'bg-rose-500/4 border-rose-500/20';
            else if (isSat) cellBg = 'bg-blue-500/4 border-blue-500/20';

            return (
              <div
                key={row.date}
                className={`flex flex-col min-h-[105px] rounded-xl border p-2 shadow-2xs transition-all hover:shadow-sm ${cellBg} ${
                  isToday ? 'ring-2 ring-teal ring-offset-1' : ''
                }`}
              >
                {/* 상단 날짜 및 공휴일 배지 */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[12px] font-extrabold ${
                        holiday || isSun ? 'text-rose-500' : isSat ? 'text-blue-500' : 'text-ink'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {isToday && (
                      <span className="rounded bg-teal px-1 py-0.2 text-[8.5px] font-bold text-white">
                        오늘
                      </span>
                    )}
                  </div>

                  {holiday && (
                    <span className="truncate rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-600 max-w-[85px]" title={holiday}>
                      {holiday}
                    </span>
                  )}
                </div>

                {/* 상태 및 출퇴근 시간 */}
                <div className="mt-auto space-y-1">
                  {/* 휴가 표시 */}
                  {row.status === 'leave' ? (
                    <div className="rounded-md bg-emerald-500/15 p-1.5 text-center border border-emerald-500/30">
                      <div className="text-[10px] font-extrabold text-emerald-600 flex items-center justify-center gap-1">
                        <span>🏖️</span>
                        <span>{row.leaveName || '연차 휴가'}</span>
                      </div>
                      <div className="text-[8.5px] font-medium text-emerald-700/80 mt-0.5">승인 완료</div>
                    </div>
                  ) : row.inAt || row.outAt ? (
                    <>
                      <div className="rounded bg-panel-alt/80 px-1.5 py-1 text-[9.5px] font-semibold text-ink2 tabular-nums">
                        <div className="flex justify-between">
                          <span className="text-ink3 text-[8.5px]">출근</span>
                          <span className="font-bold text-ink">{timeOf(row.inAt)}</span>
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-ink3 text-[8.5px]">퇴근</span>
                          <span className="font-bold text-ink">{timeOf(row.outAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1 pt-0.5">
                        <StatusBadge record={row} />
                        {row.overMin > 0 && (
                          <span className="rounded bg-indigo-500/10 px-1 py-0.5 text-[8.5px] font-bold text-indigo-500">
                            +{Math.round(row.overMin / 60 * 10) / 10}h
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-1 text-center">
                      <StatusBadge record={row} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /** 한 사람의 한 달 (캘린더 + 상세 목록 뷰) */
  const renderMonthPanel = (ownerName: string, canDrillToDay: boolean) => (
    <>
      <div className="flex flex-wrap gap-2">
        <StatCard label="근무일수" value={`${summary.workDays}일`} sub={ownerName} tone="border-teal/25 bg-teal/8" />
        <StatCard label="휴가 사용" value={`${summary.leaveDays}일`} tone="border-emerald-500/25 bg-emerald-500/8" />
        <StatCard label="지각" value={`${summary.lateDays}회`} tone={summary.lateDays > 0 ? "border-amber/25 bg-amber/8" : undefined} />
        <StatCard label="결근" value={`${summary.absentDays}일`} tone={summary.absentDays > 0 ? "border-red-500/20 bg-red-500/6" : undefined} />
        <StatCard label="연장근무" value={hourText(summary.overMinTotal)} />
      </div>

      <section className="mt-3 rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
        {/* 네비게이션 & 보기 모드 토글 */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 bg-panel">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMonth((value) => moveMonth(value, -1))} aria-label="이전 달" className={navButton}>‹</button>
            <Button size="sm" onClick={() => setMonth(thisMonth())}>이번 달</Button>
            <button type="button" onClick={() => setMonth((value) => moveMonth(value, 1))} aria-label="다음 달" className={navButton}>›</button>
            <h2 className="ml-1 text-[14px] font-extrabold text-ink">{monthTitle(month)} · {ownerName}</h2>
          </div>

          <div className="flex items-center gap-2">
            {/* 캘린더 / 목록 보기 토글 */}
            <div className={toggleShell}>
              {toggleButton('calendar', '달력 보기', displayMode === 'calendar', () => setDisplayMode('calendar'), <CalendarIcon size={13} />)}
              {toggleButton('table', '목록 표', displayMode === 'table', () => setDisplayMode('table'), <List size={13} />)}
            </div>
          </div>
        </div>

        {monthQuery.isLoading ? (
          <div className="grid min-h-64 place-items-center text-[11px] text-ink3">근태를 불러오는 중…</div>
        ) : monthRows.length === 0 ? (
          <div className="grid min-h-64 place-items-center text-[11px] text-ink3">이 달의 기록이 없습니다.</div>
        ) : displayMode === 'calendar' ? (
          renderCalendarGrid(monthRows)
        ) : (
          <div className="overflow-x-auto p-2">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold text-ink2">
                  <th className={HEAD}>날짜</th>
                  <th className={HEAD}>출근</th>
                  <th className={HEAD}>퇴근</th>
                  <th className={HEAD}>기본</th>
                  <th className={HEAD}>연장</th>
                  <th className={HEAD}>지각</th>
                  <th className={HEAD}>상태 / 휴가</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((row: CommuteRecord) => {
                  const isSun = isWeekend(row.date) && new Date(row.date).getDay() === 0;
                  const isSat = isWeekend(row.date) && new Date(row.date).getDay() === 6;
                  const holiday = getKoreanHoliday(row.date);

                  return (
                    <tr
                      key={row.date}
                      className={`border-b border-border/60 text-ink transition-colors hover:bg-panel-alt/50 ${
                        row.status === 'leave' ? 'bg-emerald-500/4' : holiday ? 'bg-rose-500/3' : ''
                      }`}
                    >
                      <td className="p-2 font-semibold">
                        {canDrillToDay ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDate(row.date);
                              setView(DAY_VIEW);
                            }}
                            title="이 날짜의 전원 보기"
                            className="hover:text-teal hover:underline flex items-center gap-1.5"
                          >
                            <span className={holiday || isSun ? 'text-rose-500' : isSat ? 'text-blue-500' : ''}>
                              {row.date.slice(5).replace('-', '/')}
                            </span>
                            {holiday && <span className="text-[9px] text-rose-500 font-bold">({holiday})</span>}
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className={holiday || isSun ? 'text-rose-500' : isSat ? 'text-blue-500' : ''}>
                              {row.date.slice(5).replace('-', '/')}
                            </span>
                            {holiday && <span className="text-[9px] text-rose-500 font-bold">({holiday})</span>}
                          </div>
                        )}
                      </td>
                      <td className="p-2 font-medium tabular-nums">{timeOf(row.inAt)}</td>
                      <td className="p-2 font-medium tabular-nums">{timeOf(row.outAt)}</td>
                      <td className="p-2 text-ink2">{hourText(row.basicMin)}</td>
                      <td className="p-2 text-ink2">{hourText(row.overMin)}</td>
                      <td className="p-2 text-ink2">{row.lateMin > 0 ? `${row.lateMin}분` : '—'}</td>
                      <td className="p-2">
                        <StatusBadge record={row} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {tableNote}
      </section>
    </>
  );

  const dayPanel = (
    <>
      <div className="flex flex-wrap gap-2">
        <StatCard label="재직 인원" value={`${dayRows.length}명`} sub={keyword.trim() ? '검색 결과 기준' : undefined} />
        <StatCard label="출근" value={`${dayStats.present}명`} tone="border-teal/25 bg-teal/8" />
        <StatCard label="지각" value={`${dayStats.late}명`} tone="border-amber/25 bg-amber/8" />
        <StatCard label="휴가" value={`${dayStats.leave}명`} tone="border-emerald-500/25 bg-emerald-500/8" />
        <StatCard label="기록 없음" value={`${dayStats.missing}명`} tone="border-red-500/20 bg-red-500/6" />
      </div>

      <section className="mt-3 rounded-xl border border-border bg-panel shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <button type="button" onClick={() => setDate((value) => moveDay(value, -1))} aria-label="이전 날" className={navButton}>‹</button>
          <Button size="sm" onClick={() => setDate(today())}>오늘</Button>
          <button type="button" onClick={() => setDate((value) => moveDay(value, 1))} aria-label="다음 날" className={navButton}>›</button>
          <h2 className="ml-1 text-[14px] font-extrabold text-ink">{dayTitle(date)}</h2>
          <input
            type="date"
            value={date}
            onChange={(event) => event.target.value && setDate(event.target.value)}
            className={`${searchInput} text-ink2`}
          />
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
                  <th className={HEAD}>직원</th>
                  <th className={HEAD}>출근</th>
                  <th className={HEAD}>퇴근</th>
                  <th className={HEAD}>기본</th>
                  <th className={HEAD}>연장</th>
                  <th className={HEAD}>지각</th>
                  <th className={HEAD}>상태 / 휴가</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map(({ employee, record }) => (
                  <tr key={employee.empId} className="border-b border-border/60 text-ink">
                    <td className="p-2 font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setMonth(date.slice(0, 7));
                          setView(String(employee.empId));
                        }}
                        title="이 직원의 월별 기록 보기"
                        className="hover:text-teal hover:underline"
                      >
                        {employee.name}
                      </button>
                    </td>
                    <td className="p-2 tabular-nums">{timeOf(record?.inAt ?? null)}</td>
                    <td className="p-2 tabular-nums">{timeOf(record?.outAt ?? null)}</td>
                    <td className="p-2 text-ink2">{hourText(record?.basicMin ?? 0)}</td>
                    <td className="p-2 text-ink2">{hourText(record?.overMin ?? 0)}</td>
                    <td className="p-2 text-ink2">{record && record.lateMin > 0 ? `${record.lateMin}분` : '—'}</td>
                    <td className="p-2">
                      {record ? <StatusBadge record={record} /> : <span className="text-[9.5px] text-ink3">기록 없음</span>}
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
        <StatCard label="휴가 합계" value={`${monthTotals.leave}일`} tone="border-emerald-500/25 bg-emerald-500/8" />
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
                  <th className={HEAD}>직원</th>
                  <th className={HEAD}>근무</th>
                  <th className={HEAD}>휴가</th>
                  <th className={HEAD}>지각</th>
                  <th className={HEAD}>결근</th>
                  <th className={HEAD}>연장</th>
                </tr>
              </thead>
              <tbody>
                {monthAllRows.map(({ employee, summary: row }) => (
                  <tr key={employee.empId} className="border-b border-border/60 text-ink">
                    <td className="p-2 font-semibold">
                      <button
                        type="button"
                        onClick={() => setView(String(employee.empId))}
                        title="이 직원의 날짜별 기록 보기"
                        className="hover:text-teal hover:underline"
                      >
                        {employee.active ? employee.name : `${employee.name} (퇴사)`}
                      </button>
                    </td>
                    <td className="p-2 text-ink2 font-medium">{row.workDays}일</td>
                    <td className={`p-2 ${row.leaveDays > 0 ? 'font-bold text-emerald-600' : 'text-ink3'}`}>{row.leaveDays}일</td>
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
      <GwHead
        icon="⏱️"
        name="근태"
        right={
          <div className="flex items-center gap-2">
            {canManagePolicy && (
              <button
                type="button"
                onClick={() => setIsPolicyModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-panel-alt transition-colors shadow-2xs"
                title="출/퇴근 시간 및 근무정책 설정"
              >
                <Clock size={13} className="text-amber-500" />
                <span>{policy.workStartTime}~{policy.workEndTime}</span>
                <Settings size={12} className="text-ink3" />
              </button>
            )}
            {tabToggle}
          </div>
        }
      />

      {isTeam ? (
        <GwSplit
          nav={
            <GwSideNav title={scopeLabel}>
              <div className="mb-3">{modeToggle}</div>
              <div className="space-y-2">
                {searchBox}
                <label className="flex items-center gap-1.5 text-[11px] text-ink2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showRetired}
                    onChange={(event) => setShowRetired(event.target.checked)}
                    className="accent-teal rounded"
                  />
                  <span>퇴사자 포함</span>
                </label>
              </div>
            </GwSideNav>
          }
        >
          {isEmployeeView ? (
            renderMonthPanel(selected?.name ?? '직원 선택', true)
          ) : view === DAY_VIEW ? (
            dayPanel
          ) : (
            monthAllPanel
          )}
        </GwSplit>
      ) : (
        <div className="mt-4">
          {renderMonthPanel(user?.name || viewer?.name || '내 근태', false)}
        </div>
      )}

      {/* 근무시간 및 정책 설정 모달 */}
      <CommutePolicyModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        policy={policy}
        onSave={savePolicy}
      />
    </div>
  );
}
