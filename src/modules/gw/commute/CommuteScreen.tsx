import { useCallback, useMemo, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  COMMUTE_STATUS_LABELS,
  summarizeCommuteMonth,
  type CommuteRecord,
} from '@/domain/commute/schema';
import { COMMUTE_STATUS_TONES } from '@/data/commute/commute.fixture';
import {
  useCommuteEmployees,
  useCommuteMonth,
  useCommuteMonthAll,
  useCommuteViewer,
} from '@/features/commute/useCommute';
import { useAuth } from '@/app/auth/AuthProvider';
import { usePermission } from '@/features/auth/usePermission';
import { resolveCommuteScope } from '@/features/auth/scopeHelper';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useUsers } from '@/features/user/useUsers';
import { useEmployeeProfiles } from '@/features/employeeProfile/useEmployeeProfiles';
import { useHolidays } from '@/features/holiday/useHolidays';
import { GwHead } from '@/modules/gw/_gw';
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
import { EmployeeDetailDrawer } from './components/EmployeeDetailDrawer';
import { CommuteMatrixView } from './components/CommuteMatrixView';
import { CommuteDeptView } from './components/CommuteDeptView';
import { CommuteAnomalyView } from './components/CommuteAnomalyView';
import { CommuteLeaveView } from './components/CommuteLeaveView';
import { MyLeaveTab } from './components/MyLeaveTab';
import { LeaveLedgerTable } from '../leave/components/LeaveLedgerTable';
import { LeaveAdjustmentModal } from '../leave/components/LeaveAdjustmentModal';
import {
  buildLeaveLedger,
  type LeaveLedgerEntry,
} from '@/domain/leave/ledger';
import {
  getStoredAdjustments,
  type LeaveAdjustmentTransaction,
} from '@/domain/leave/adjustmentStore';
import type { CommuteAdminTab, CommutePersonRow, DeptSummary, AnomalyItem } from './types';
import {
  Settings,
  Clock,
  Calendar as CalendarIcon,
  List,
  Info,
  Building2,
  AlertTriangle,
  Users,
  Search,
  CalendarCheck2,
  Filter,
  BookOpen,
} from 'lucide-react';

/** 탭 상수 */
const ME_TAB = 'me';
const LEAVE_TAB = 'leave';
const TEAM_TAB = 'team';

/**
 * 근태 관리 제외 대상 여부 판정
 * 1. 부서: 경영기술전략위원회 / 기술경영전략위원회 등 위원회 소속
 * 2. 직급/직책: 상무이사 이상 (상무, 상무이사, 전무, 부사장, 사장, 대표이사, 위원장, 부위원장 등)
 */
function isNonAttendanceTarget(info?: {
  name?: string | null;
  dept?: string | null;
  position?: string | null;
  jobTitle?: string | null;
} | null): boolean {
  if (!info) return false;
  const dept = (info.dept || '').trim();
  const position = (info.position || '').trim();
  const jobTitle = (info.jobTitle || '').trim();
  const name = (info.name || '').trim();

  // 1. 위원회 부서 제외
  if (
    dept.includes('경영기술전략위원회') ||
    dept.includes('기술경영전략위원회') ||
    dept.includes('전략위원회')
  ) {
    return true;
  }

  // 2. 상무이사 이상 임원진 (상무, 전무, 부사장, 사장, 대표이사, 위원장, 부위원장, 회장 등)
  const executiveKeywords = [
    '상무',
    '전무',
    '부사장',
    '사장',
    '대표이사',
    '위원장',
    '부위원장',
    '회장',
    '부회장',
  ];

  const fullText = `${position} ${jobTitle} ${name}`;
  if (executiveKeywords.some((keyword) => fullText.includes(keyword))) {
    return true;
  }

  if (name.includes('대표이사') || name === '대표') {
    return true;
  }

  return false;
}

const NON_ATTENDANCE_NAMES = new Set(['위원장님', '부위원장님', '대표이사']);

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

const monthTitle = (month: string): string => `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;

const timeOf = (iso: string | null): string => {
  if (!iso) return '—';
  const at = new Date(iso);
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
};

const hourText = (min: number): string => (min === 0 ? '—' : `${Math.floor(min / 60)}h ${min % 60}m`);

function StatCard({
  label,
  value,
  sub,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`min-w-0 flex-1 rounded-xl border px-4 py-3 shadow-2xs transition-all ${
        onClick ? 'cursor-pointer hover:border-teal/50 hover:shadow-sm' : ''
      } ${active ? 'ring-2 ring-teal border-teal bg-teal/10' : tone ?? 'border-border bg-panel'}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold text-ink3">{label}</div>
        {active && <span className="h-1.5 w-1.5 rounded-full bg-teal" />}
      </div>
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
const toggleShell = 'flex items-center gap-0.5 self-center rounded-lg border border-border bg-panel p-0.5 shadow-2xs';

export default function CommuteScreen() {
  const { user } = useAuth();
  const { userRoles, isAdmin } = usePermission();
  const org = useOrgTree();
  const { policy = DEFAULT_COMMUTE_POLICY, savePolicy } = useCommutePolicy();
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  // DB 연동 공휴일 목록 및 빠른 조회를 위한 Date -> Name 맵
  const { data: holidays = [] } = useHolidays();
  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    holidays.forEach((h) => {
      map.set(h.date, h.name);
    });
    return map;
  }, [holidays]);

  const commuteScope = useMemo(() => resolveCommuteScope(user, userRoles, org), [user, userRoles, org]);
  const canAll = isAdmin || commuteScope === 'ALL';
  const canManagePolicy = canAll;

  const viewerQuery = useCommuteViewer();
  const viewer = viewerQuery.data;

  // 시스템 전체 사용자 목록
  const usersQuery = useUsers();
  const allUsers = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  // 이름 공백 정규화 (예: '모 란' vs '모란' 동일인 처리)
  const normName = useCallback((s?: string | null) => (s || '').replace(/\s+/g, ''), []);

  // CAPS 연동 직원 목록
  const employeesQuery = useCommuteEmployees();
  const allEmployees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

  // CAPS DB 임직원과 시스템 전체 사용자(allUsers)를 통합
  const employees = useMemo(() => {
    const list = [...allEmployees.filter((row) => !NON_ATTENDANCE_NAMES.has(row.name.trim()) && !isNonAttendanceTarget({ name: row.name }))];
    const existingNormNames = new Set(list.map((e) => normName(e.name)));
    const existingEmpIds = new Set(list.map((e) => e.empId));

    const isViewerTester = (user?.dept ?? '').includes('테스트') || (user?.name ?? '').toLowerCase().includes('test');

    for (const u of allUsers) {
      const name = (u.name || '').trim();
      const nName = normName(name);
      if (!name || !nName || existingNormNames.has(nName) || NON_ATTENDANCE_NAMES.has(name) || NON_ATTENDANCE_NAMES.has(nName) || isNonAttendanceTarget(u)) continue;

      const isUserTester = (u.dept ?? '').includes('테스트') || name.toLowerCase().includes('test');
      if (isUserTester && !isViewerTester) continue;

      let empId = Number(u.empNo);
      if (Number.isNaN(empId) || empId <= 0 || existingEmpIds.has(empId)) {
        let hash = 0;
        const key = u.id || name;
        for (let i = 0; i < key.length; i++) {
          hash = ((hash << 5) - hash) + key.charCodeAt(i);
          hash |= 0;
        }
        empId = 10000 + (Math.abs(hash) % 80000);
        while (existingEmpIds.has(empId)) empId++;
      }

      existingNormNames.add(nName);
      existingEmpIds.add(empId);

      list.push({
        empId,
        name,
        active: u.status === '사용' && !u.resignedAt,
        retireDate: u.resignedAt ?? null,
      });
    }

    return list;
  }, [allEmployees, allUsers, user?.dept, user?.name, normName]);

  const userByEmpMap = useMemo(() => {
    const map = new Map<string, typeof allUsers[0]>();
    for (const u of allUsers) {
      if (u.empNo) map.set(u.empNo.trim(), u);
      if (u.name) {
        map.set(u.name.trim(), u);
        map.set(normName(u.name), u);
      }
      if (u.id) map.set(u.id.trim(), u);
    }
    for (const emp of employees) {
      const matched = allUsers.find(
        (u) => normName(u.name) === normName(emp.name) || u.empNo?.trim() === String(emp.empId),
      );
      if (matched) {
        map.set(String(emp.empId), matched);
        map.set(emp.name.trim(), matched);
        map.set(normName(emp.name), matched);
      }
    }
    return map;
  }, [allUsers, employees, normName]);

  const { data: employeeProfiles = [] } = useEmployeeProfiles();
  const profileByEmpMap = useMemo(() => {
    const map = new Map<string, typeof employeeProfiles[0]>();
    for (const p of employeeProfiles) {
      if (p.empNo) map.set(p.empNo.trim(), p);
      if (p.name) {
        map.set(p.name.trim(), p);
        map.set(normName(p.name), p);
      }
      if (p.userId) map.set(p.userId.trim(), p);
    }
    return map;
  }, [employeeProfiles, normName]);

  const getHireDateForEmp = useCallback(
    (empName?: string | null, empId?: number | null) => {
      if (!empName && !empId) return null;
      const profile =
        (empName ? (profileByEmpMap.get(empName.trim()) ?? profileByEmpMap.get(normName(empName))) : undefined) ??
        (empId ? profileByEmpMap.get(String(empId)) : undefined);
      return profile?.hireDate ? profile.hireDate.trim() : null;
    },
    [profileByEmpMap, normName],
  );

  // 상위 탭 상태 (내 근태 vs 내 연차·휴가 vs 전사 관리)
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const initialTab = urlTab === LEAVE_TAB ? LEAVE_TAB : (urlTab === TEAM_TAB && canAll) ? TEAM_TAB : ME_TAB;
  const [tab, setTab] = useState<string>(initialTab);

  const handleTabChange = useCallback((nextTab: string) => {
    setTab(nextTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextTab === ME_TAB) {
        next.delete('tab');
      } else {
        next.set('tab', nextTab);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const activeTab = (tab === TEAM_TAB && !canAll) ? ME_TAB : tab;
  const isTeam = activeTab === TEAM_TAB;

  // 관제 서브 View 탭 상태
  const urlAdminTab = searchParams.get('adminTab') as CommuteAdminTab | null;
  const [adminTab, setAdminTab] = useState<CommuteAdminTab>(urlAdminTab || 'all_matrix');

  const handleAdminTabChange = useCallback((nextAdminTab: CommuteAdminTab) => {
    setAdminTab(nextAdminTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('adminTab', nextAdminTab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // URL 변경 시 adminTab 동기화
  useEffect(() => {
    if (urlAdminTab && urlAdminTab !== adminTab) {
      setAdminTab(urlAdminTab);
    }
  }, [urlAdminTab, adminTab]);

  // 연차 원장 산정 모드 & 수동 가감 상태
  const [ledgerMode, setLedgerMode] = useState<'HIRE_DATE' | 'FISCAL_YEAR'>('HIRE_DATE');
  const [adjustmentTarget, setAdjustmentTarget] = useState<LeaveLedgerEntry | null>(null);
  const [adjustments, setAdjustments] = useState<LeaveAdjustmentTransaction[]>(() => getStoredAdjustments());

  useEffect(() => {
    const handleUpdate = () => {
      setAdjustments(getStoredAdjustments());
    };
    window.addEventListener('workfit-leave-adjustment-updated', handleUpdate);
    return () => window.removeEventListener('workfit-leave-adjustment-updated', handleUpdate);
  }, []);

  // 필터 상태
  const [month, setMonth] = useState(thisMonth());
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [onlyAnomaly, setOnlyAnomaly] = useState<boolean>(false);
  const [keyword, setKeyword] = useState('');
  const [showRetired, setShowRetired] = useState(false);

  // 테스트 계정일 때: 테스트 부서/계정 제외 토글 상태
  const isViewerTester = useMemo(
    () => (user?.dept ?? '').includes('테스트') || (user?.name ?? '').toLowerCase().includes('test'),
    [user?.dept, user?.name],
  );
  const [excludeTestDept, setExcludeTestDept] = useState(false);

  // 상세 슬라이드오버 상태
  const [selectedPersonDetail, setSelectedPersonDetail] = useState<CommutePersonRow | null>(null);

  // 내 근태 보기 방식: 'calendar' vs 'table'
  const [displayMode, setDisplayMode] = useState<'calendar' | 'table'>('calendar');

  const myEmpId = useMemo(() => {
    if (viewer?.empId) return viewer.empId;
    const found = employees.find((e) => e.name.trim() === (user?.name ?? '').trim());
    return found?.empId ?? (user ? 99999 : null);
  }, [viewer?.empId, employees, user]);

  // 내 근태 쿼리
  const myMonthQuery = useCommuteMonth(myEmpId, month);

  // 전사 한 달치 전 직원 쿼리
  const monthAllQuery = useCommuteMonthAll(isTeam ? month : null);

  // 전자결재 승인 휴가 데이터 연동
  const approvalsQuery = useAllApprovals();

  // 휴가 맵 생성
  const globalLeaveMap = useMemo(() => {
    const map = new Map<string, Map<string, ApprovedLeaveInfo>>();

    for (const doc of approvalsQuery.data ?? []) {
      if (doc.docType !== '휴가' || doc.status !== '완료' || !doc.form) continue;

      const drafterName = (doc.drafterName || '').trim();
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

        const leaveInfo = {
          leaveType: doc.form.leaveType || '연차',
          docTitle: doc.title,
          docId: doc.id,
        };

        if (!map.has(drafterName)) map.set(drafterName, new Map());
        map.get(drafterName)!.set(dateKey, leaveInfo);
        const normDrafter = normName(drafterName);
        if (normDrafter && !map.has(normDrafter)) map.set(normDrafter, new Map());
        if (normDrafter) map.get(normDrafter)!.set(dateKey, leaveInfo);

        curr.setDate(curr.getDate() + 1);
      }
    }
    return map;
  }, [approvalsQuery.data, normName]);

  // 내 전용 휴가 맵
  const myLeaveMap = useMemo(() => {
    const targetName = user?.name?.trim() ?? '';
    return globalLeaveMap.get(targetName) ?? new Map();
  }, [globalLeaveMap, user?.name]);

  const myHireDate = useMemo(() => {
    return getHireDateForEmp(user?.name, user?.empNo ? Number(user.empNo) : null);
  }, [user, getHireDateForEmp]);

  // 전사 연차 원장 실시간 집계 (전사 권한자 전용)
  const { entries: leaveLedgerEntries, summary: leaveLedgerSummary } = useMemo(() => {
    if (!canAll) {
      return {
        entries: [],
        summary: {
          totalEmployees: 0,
          totalEntitled: 0,
          totalAdjusted: 0,
          totalGranted: 0,
          totalUsed: 0,
          totalPending: 0,
          totalRemaining: 0,
          avgUsageRate: 0,
          advanceEmployeeCount: 0,
        },
      };
    }

    const empInput = employees.map((e) => {
      const u =
        userByEmpMap.get(e.name.trim()) ??
        userByEmpMap.get(normName(e.name)) ??
        userByEmpMap.get(String(e.empId));
      const hire = getHireDateForEmp(e.name, e.empId);
      return {
        empId: e.empId,
        empNo: u?.empNo ? String(u.empNo) : String(e.empId),
        name: e.name,
        dept: u?.dept || null,
        position: u?.position || null,
        hireDate: hire,
      };
    });

    return buildLeaveLedger(
      empInput,
      employeeProfiles,
      approvalsQuery.data ?? [],
      adjustments,
      { mode: ledgerMode },
    );
  }, [
    canAll,
    employees,
    userByEmpMap,
    normName,
    getHireDateForEmp,
    employeeProfiles,
    approvalsQuery.data,
    adjustments,
    ledgerMode,
  ]);

  // 내 근태 한 달치 레코드
  const myMonthRows = useMemo(() => {
    const rawMap = new Map<string, CommuteRecord>();
    for (const r of myMonthQuery.data ?? []) {
      rawMap.set(r.date, r);
    }

    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return [];

    const daysInMonth = new Date(y, m, 0).getDate();
    const records: CommuteRecord[] = [];

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${month}-${pad(dayNum)}`;
      const raw =
        rawMap.get(dateStr) ?? {
          empId: myEmpId ?? 0,
          date: dateStr,
          inAt: null,
          outAt: null,
        };
      records.push(evaluateCommuteRecord(raw, policy, myLeaveMap, myHireDate, holidayMap));
    }
    return records;
  }, [myMonthQuery.data, month, myEmpId, policy, myLeaveMap, myHireDate, holidayMap]);

  const mySummary = useMemo(() => summarizeCommuteMonth(myMonthRows), [myMonthRows]);

  // 관제 대상 직원 필터링 (권한 범위 기반 및 비대상자 제외)
  const scopedEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchedUser = userByEmpMap.get(emp.name.trim()) ?? userByEmpMap.get(normName(emp.name)) ?? userByEmpMap.get(String(emp.empId));

      // 경영기술전략위원회 및 상무이사 이상 임원은 근태 관리 대상에서 제외
      if (isNonAttendanceTarget(matchedUser) || isNonAttendanceTarget({ name: emp.name })) {
        return false;
      }

      // 테스트 부서 제외 옵션 활성화 시 테스트 계정 및 테스트 부서 제외
      if (excludeTestDept) {
        const isTester =
          (matchedUser?.dept ?? '').includes('테스트') ||
          (matchedUser?.name ?? '').toLowerCase().includes('test') ||
          emp.name.toLowerCase().includes('test');
        if (isTester) return false;
      }

      if (commuteScope === 'ALL') return true;

      if (commuteScope === 'TEAM') {
        const myDept = (user?.dept ?? '').trim();
        const empDept = (matchedUser?.dept ?? '').trim();
        return Boolean(myDept && empDept && myDept === empDept);
      }

      return false;
    });
  }, [employees, commuteScope, user?.dept, userByEmpMap, normName, excludeTestDept]);

  // 부서 목록 추출
  const deptList = useMemo(() => {
    const set = new Set<string>();
    for (const emp of scopedEmployees) {
      const u = userByEmpMap.get(emp.name.trim()) ?? userByEmpMap.get(normName(emp.name)) ?? userByEmpMap.get(String(emp.empId));
      if (u?.dept && u.dept.trim()) set.add(u.dept.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [scopedEmployees, userByEmpMap, normName]);

  // 전사 직원들의 한 달치 데이터 매트릭스 구성
  const allPersonRows = useMemo(() => {
    const rawByEmp = new Map<number, Map<string, CommuteRecord>>();
    for (const row of monthAllQuery.data ?? []) {
      if (!rawByEmp.has(row.empId)) rawByEmp.set(row.empId, new Map());
      rawByEmp.get(row.empId)!.set(row.date, row);
    }

    const [y, m] = month.split('-').map(Number);
    const totalDays = y && m ? new Date(y, m, 0).getDate() : 0;

    const list: CommutePersonRow[] = [];

    for (const emp of scopedEmployees) {
      const u = userByEmpMap.get(emp.name.trim()) ?? userByEmpMap.get(normName(emp.name)) ?? userByEmpMap.get(String(emp.empId));
      const hireDate = getHireDateForEmp(emp.name, emp.empId);
      const personLeaveMap = globalLeaveMap.get(emp.name.trim()) ?? globalLeaveMap.get(normName(emp.name)) ?? new Map();
      const rawMap = rawByEmp.get(emp.empId);

      const records: CommuteRecord[] = [];
      const recordsMap = new Map<string, CommuteRecord>();

      for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
        const dateStr = `${month}-${pad(dayNum)}`;
        const raw =
          rawMap?.get(dateStr) ?? {
            empId: emp.empId,
            date: dateStr,
            inAt: null,
            outAt: null,
          };
        const evaluated = evaluateCommuteRecord(raw, policy, personLeaveMap, hireDate, holidayMap);
        records.push(evaluated);
        recordsMap.set(dateStr, evaluated);
      }

      // 입사일 이전 달이라 유효 출퇴근 기록이 없는 사원은 해당 월 명단에서 제외
      const hasValidWork = records.some(
        (r) => r.status === 'normal' || r.status === 'late' || r.status === 'holiday_work' || r.status === 'leave',
      );
      const isPreHireMonth = records.every((r) => r.status === 'unknown' || r.status === 'off');
      if (!hasValidWork && isPreHireMonth) {
        continue;
      }

      const summary = summarizeCommuteMonth(records);

      const anomalyRecords = records.filter(
        (rec) =>
          rec.status === 'late' ||
          rec.status === 'absent' ||
          rec.status === 'missing_in' ||
          rec.status === 'missing_out',
      );

      list.push({
        empId: emp.empId,
        name: u?.name?.trim() || emp.name,
        empNo: u?.empNo,
        dept: u?.dept ?? '부서 미지정',
        position: u?.position ?? '사원',
        hireDate,
        active: emp.active,
        records,
        recordsMap,
        summary,
        anomalyRecords,
        anomalyCount: anomalyRecords.length,
      });
    }

    return list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [scopedEmployees, monthAllQuery.data, month, policy, globalLeaveMap, getHireDateForEmp, userByEmpMap, holidayMap]);

  // 글로벌 필터 적용된 PersonRows
  const filteredPersonRows = useMemo(() => {
    return allPersonRows.filter((row) => {
      if (!showRetired && !row.active) return false;

      if (selectedDept !== 'ALL' && row.dept !== selectedDept) return false;

      const q = keyword.trim().toLowerCase();
      if (q) {
        const matchName = row.name.toLowerCase().includes(q);
        const matchEmpNo = (row.empNo ?? '').toLowerCase().includes(q);
        const matchDept = row.dept.toLowerCase().includes(q);
        if (!matchName && !matchEmpNo && !matchDept) return false;
      }

      if (onlyAnomaly && row.anomalyCount === 0) return false;

      if (statusFilter !== 'ALL') {
        if (statusFilter === 'missing') {
          const hasMissing = row.records.some(
            (r) => r.status === 'missing_in' || r.status === 'missing_out',
          );
          if (!hasMissing) return false;
        } else if (statusFilter === 'present' || statusFilter === 'normal') {
          const hasNormal = row.records.some((r) => r.status === 'normal');
          if (!hasNormal) return false;
        } else {
          const hasStatus = row.records.some((r) => r.status === statusFilter);
          if (!hasStatus) return false;
        }
      }

      return true;
    });
  }, [allPersonRows, showRetired, selectedDept, keyword, onlyAnomaly, statusFilter]);

  // 상단 KPI 통계 집계
  const kpiStats = useMemo(() => {
    const totalMembers = allPersonRows.length;
    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;
    let totalLeave = 0;
    let totalAnomaly = 0;

    for (const row of allPersonRows) {
      totalPresent += row.summary.workDays;
      totalLate += row.summary.lateDays;
      totalAbsent += row.summary.absentDays;
      totalLeave += row.summary.leaveDays;
      totalAnomaly += row.anomalyCount;
    }

    return {
      totalMembers,
      totalPresent,
      totalLate,
      totalAbsent,
      totalLeave,
      totalAnomaly,
    };
  }, [allPersonRows]);

  // 부서별 통계 집계
  const deptSummaries: DeptSummary[] = useMemo(() => {
    const map = new Map<string, CommutePersonRow[]>();
    for (const row of allPersonRows) {
      const d = row.dept || '부서 미지정';
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(row);
    }

    const summaries: DeptSummary[] = [];
    for (const [dept, members] of map.entries()) {
      let presentDays = 0;
      let lateCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      let anomalyCount = 0;

      for (const m of members) {
        presentDays += m.summary.workDays;
        lateCount += m.summary.lateDays;
        absentCount += m.summary.absentDays;
        leaveCount += m.summary.leaveDays;
        anomalyCount += m.anomalyCount;
      }

      const totalWorkTarget = members.length * 20;
      const attendanceRate =
        totalWorkTarget > 0 ? Math.min(100, Math.round((presentDays / totalWorkTarget) * 100)) : 100;

      summaries.push({
        dept,
        memberCount: members.length,
        presentDays,
        lateCount,
        absentCount,
        leaveCount,
        anomalyCount,
        attendanceRate,
      });
    }

    return summaries.sort((a, b) => b.memberCount - a.memberCount);
  }, [allPersonRows]);

  // 전체 이상 근태 항목 목록
  const anomalyItems: AnomalyItem[] = useMemo(() => {
    const items: AnomalyItem[] = [];
    for (const row of allPersonRows) {
      if (selectedDept !== 'ALL' && row.dept !== selectedDept) continue;
      if (keyword.trim()) {
        const q = keyword.trim().toLowerCase();
        if (!row.name.toLowerCase().includes(q) && !(row.empNo ?? '').includes(q)) continue;
      }

      for (const rec of row.anomalyRecords) {
        let typeLabel = '이상';
        let note = '';
        if (rec.status === 'late') {
          typeLabel = '지각';
          note = `규정 시각(${policy.workStartTime}) 대비 ${rec.lateMin}분 지각`;
        } else if (rec.status === 'absent') {
          typeLabel = '결근';
          note = '출근 기록 없음 (미승인 결근)';
        } else if (rec.status === 'missing_in') {
          typeLabel = '출근 누락';
          note = '퇴근 태그만 기록됨';
        } else if (rec.status === 'missing_out') {
          typeLabel = '퇴근 누락';
          note = '퇴근 미체크 (출근만 기록)';
        }

        items.push({
          id: `${row.empId}-${rec.date}`,
          date: rec.date,
          empId: row.empId,
          name: row.name,
          dept: row.dept,
          position: row.position,
          status: rec.status,
          typeLabel,
          inAt: rec.inAt,
          outAt: rec.outAt,
          lateMin: rec.lateMin,
          note,
          record: rec,
        });
      }
    }

    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [allPersonRows, selectedDept, keyword, policy.workStartTime]);

  const personMap = useMemo(() => {
    const map = new Map<number, CommutePersonRow>();
    for (const p of allPersonRows) map.set(p.empId, p);
    return map;
  }, [allPersonRows]);

  // 부서 클릭 시 드릴다운 처리
  const handleDrillDownDept = useCallback((dept: string) => {
    setSelectedDept(dept);
    setAdminTab('all_matrix');
  }, []);

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

  const tabToggle = (
    <div className={toggleShell}>
      {toggleButton(ME_TAB, '내 근태', activeTab === ME_TAB, () => handleTabChange(ME_TAB))}
      {toggleButton(LEAVE_TAB, '내 연차·휴가', activeTab === LEAVE_TAB, () => handleTabChange(LEAVE_TAB))}
      {canAll && (
        toggleButton(
          TEAM_TAB,
          '전사 관리',
          isTeam,
          () => handleTabChange(TEAM_TAB),
        )
      )}
    </div>
  );

  /** 캘린더 그리드 렌더러 (내 근태 전용) */
  const renderCalendarGrid = (rows: CommuteRecord[]) => {
    if (rows.length === 0) return null;

    const [y, m] = month.split('-').map(Number);
    const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
    const todayStr = today();

    return (
      <div className="p-3">
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold pb-2 border-b border-border mb-1.5">
          <div className="text-rose-500">일 (Sun)</div>
          <div className="text-ink">월 (Mon)</div>
          <div className="text-ink">화 (Tue)</div>
          <div className="text-ink">수 (Wed)</div>
          <div className="text-ink">목 (Thu)</div>
          <div className="text-ink">금 (Fri)</div>
          <div className="text-blue-500">토 (Sat)</div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstDayOfWeek }).map((_, index) => (
            <div key={`empty-${index}`} className="min-h-[92px] rounded-lg border border-transparent p-1.5 bg-panel-alt/20" />
          ))}

          {rows.map((row) => {
            const dayNum = Number(row.date.slice(8));
            const holiday = getKoreanHoliday(row.date, holidayMap);
            const isSun = new Date(row.date).getDay() === 0;
            const isSat = new Date(row.date).getDay() === 6;
            const isToday = row.date === todayStr;

            return (
              <div
                key={row.date}
                className={`flex min-h-[95px] flex-col rounded-xl border p-2 transition-all ${
                  isToday
                    ? 'border-teal bg-teal/5 shadow-xs ring-1 ring-teal/30'
                    : holiday || isSun
                    ? 'border-rose-500/25 bg-rose-500/5'
                    : isSat
                    ? 'border-blue-500/25 bg-blue-500/5'
                    : 'border-border bg-panel hover:border-border-strong hover:bg-panel-alt/40'
                }`}
              >
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
                </div>

                <div className="mt-auto space-y-1">
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
                      <div className="flex items-center justify-start gap-1 pt-0.5">
                        <StatusBadge record={row} />
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

  /** 내 근태 패널 */
  const myCommutePanel = (
    <>
      <div className="flex flex-wrap gap-2">
        <StatCard label="근무일수" value={`${mySummary.workDays}일`} sub={user?.name} tone="border-teal/25 bg-teal/8" />
        <StatCard label="휴가 사용" value={`${mySummary.leaveDays}일`} tone="border-emerald-500/25 bg-emerald-500/8" />
        <StatCard label="지각" value={`${mySummary.lateDays}회`} tone={mySummary.lateDays > 0 ? 'border-amber/25 bg-amber/8' : undefined} />
        <StatCard label="결근" value={`${mySummary.absentDays}일`} tone={mySummary.absentDays > 0 ? 'border-red-500/20 bg-red-500/6' : undefined} />
        <StatCard label="총 근무시간" value={hourText(mySummary.totalMin)} />
      </div>

      <section className="mt-3 rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 bg-panel">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMonth((v) => moveMonth(v, -1))} aria-label="이전 달" className={navButton}>‹</button>
            <Button size="sm" onClick={() => setMonth(thisMonth())}>이번 달</Button>
            <button type="button" onClick={() => setMonth((v) => moveMonth(v, 1))} aria-label="다음 달" className={navButton}>›</button>
            <h2 className="ml-1 text-[14px] font-extrabold text-ink">{monthTitle(month)} · {user?.name}</h2>
          </div>

          <div className="flex items-center gap-2">
            <div className={toggleShell}>
              {toggleButton('calendar', '달력 보기', displayMode === 'calendar', () => setDisplayMode('calendar'), <CalendarIcon size={13} />)}
              {toggleButton('table', '목록 표', displayMode === 'table', () => setDisplayMode('table'), <List size={13} />)}
            </div>
          </div>
        </div>

        {myMonthQuery.isLoading ? (
          <div className="grid min-h-64 place-items-center text-[11px] text-ink3">근태를 불러오는 중…</div>
        ) : myMonthRows.length === 0 ? (
          <div className="grid min-h-64 place-items-center text-[11px] text-ink3">이 달의 기록이 없습니다.</div>
        ) : displayMode === 'calendar' ? (
          renderCalendarGrid(myMonthRows)
        ) : (
          <div className="overflow-x-auto p-2">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold text-ink2">
                  <th className={HEAD}>날짜</th>
                  <th className={HEAD}>출근</th>
                  <th className={HEAD}>퇴근</th>
                  <th className={HEAD}>근무시간</th>
                  <th className={HEAD}>지각</th>
                  <th className={HEAD}>상태 / 휴가</th>
                </tr>
              </thead>
              <tbody>
                {myMonthRows.map((row) => {
                  const isSun = isWeekend(row.date) && new Date(row.date).getDay() === 0;
                  const isSat = isWeekend(row.date) && new Date(row.date).getDay() === 6;
                  const holiday = getKoreanHoliday(row.date, holidayMap);

                  return (
                    <tr key={row.date} className="border-b border-border/60 text-ink">
                      <td className="p-2 font-semibold">
                        <span className={holiday || isSun ? 'text-rose-500' : isSat ? 'text-blue-500' : ''}>
                          {row.date.slice(5).replace('-', '/')}
                        </span>
                        {holiday && <span className="ml-1 text-[9px] text-rose-500 font-bold">({holiday})</span>}
                      </td>
                      <td className="p-2 font-medium tabular-nums">{timeOf(row.inAt)}</td>
                      <td className="p-2 font-medium tabular-nums">{timeOf(row.outAt)}</td>
                      <td className="p-2 text-ink2">{hourText(row.totalMin)}</td>
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
        <div className="flex items-center gap-1.5 px-3 py-3 text-[10px] text-ink3">
          <Info size={12} className="text-teal shrink-0" />
          <span>{NOTE}</span>
        </div>
      </section>
    </>
  );

  /** 전사 근태 관제 대시보드 패널 */
  const adminControlPanel = (
    <div className="space-y-3">
      {/* 1. 상단 KPI 관제 카드 (인터랙티브 필터 연동) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatCard
          label="전체 인원"
          value={`${kpiStats.totalMembers}명`}
          sub={commuteScope === 'ALL' ? '전사 전 임직원' : `${user?.dept || '부서'} 기준`}
          onClick={() => {
            setStatusFilter('ALL');
            setOnlyAnomaly(false);
          }}
          active={statusFilter === 'ALL' && !onlyAnomaly}
        />
        <StatCard
          label="정상 출근"
          value={`${kpiStats.totalPresent}건`}
          sub="당월 누적 출근"
          tone="border-teal/25 bg-teal/8"
          onClick={() => {
            setStatusFilter('present');
            setOnlyAnomaly(false);
          }}
          active={statusFilter === 'present'}
        />
        <StatCard
          label="지각"
          value={`${kpiStats.totalLate}건`}
          tone={kpiStats.totalLate > 0 ? 'border-amber/25 bg-amber/8' : undefined}
          onClick={() => {
            setStatusFilter('late');
            setOnlyAnomaly(false);
          }}
          active={statusFilter === 'late'}
        />
        <StatCard
          label="결근"
          value={`${kpiStats.totalAbsent}건`}
          tone={kpiStats.totalAbsent > 0 ? 'border-rose-500/20 bg-rose-500/6' : undefined}
          onClick={() => {
            setStatusFilter('absent');
            setOnlyAnomaly(false);
          }}
          active={statusFilter === 'absent'}
        />
        <StatCard
          label="휴가"
          value={`${kpiStats.totalLeave}건`}
          sub="승인 완료 건수"
          tone="border-emerald-500/25 bg-emerald-500/8"
          onClick={() => {
            if (canAll) {
              handleAdminTabChange('leave_ledger');
            } else {
              handleAdminTabChange('leave');
            }
          }}
          active={adminTab === 'leave_ledger' || adminTab === 'leave'}
        />
        <StatCard
          label="🚨 관리 필요"
          value={`${kpiStats.totalAnomaly}건`}
          sub="지각 · 결근 · 미기록"
          tone="border-rose-500/40 bg-rose-500/12 ring-1 ring-rose-500/25"
          onClick={() => {
            setOnlyAnomaly((prev) => !prev);
            setStatusFilter('ALL');
            setAdminTab('anomaly');
          }}
          active={onlyAnomaly || adminTab === 'anomaly'}
        />
      </div>

      {/* 2. 글로벌 필터 바 & 관제 탭 */}
      <section className="rounded-xl border border-border bg-panel p-3 shadow-2xs space-y-3">
        {/* 상단 뷰 탭 & 기간 컨트롤러 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex flex-wrap items-center gap-1 bg-panel-alt p-0.5 rounded-lg border border-border shadow-2xs">
            {toggleButton('all_matrix', '① 전사·부서별 근태', adminTab === 'all_matrix', () => handleAdminTabChange('all_matrix'), <Users size={13} />)}
            {toggleButton(
              'anomaly',
              `② 이상 근태 (${anomalyItems.length})`,
              adminTab === 'anomaly',
              () => handleAdminTabChange('anomaly'),
              <AlertTriangle size={13} className={anomalyItems.length > 0 ? 'text-rose-500' : ''} />,
            )}
            {canAll && (
              toggleButton(
                'leave_ledger',
                '③ 전사 연차 원장',
                adminTab === 'leave_ledger',
                () => handleAdminTabChange('leave_ledger'),
                <BookOpen size={13} />,
              )
            )}
            {toggleButton('leave', '④ 승인 휴가 목록', adminTab === 'leave', () => handleAdminTabChange('leave'), <CalendarCheck2 size={13} />)}
          </div>

          {adminTab !== 'leave_ledger' ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={() => setMonth((v) => moveMonth(v, -1))} aria-label="이전 달" className={navButton}>‹</button>
              <Button size="sm" onClick={() => setMonth(thisMonth())}>이번 달</Button>
              <button type="button" onClick={() => setMonth((v) => moveMonth(v, 1))} aria-label="다음 달" className={navButton}>›</button>
              <h2 className="ml-1 text-[13.5px] font-extrabold text-ink">{monthTitle(month)}</h2>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11.5px] font-extrabold text-teal shrink-0">
              <span>📅 {new Date().getFullYear()}년도 전사 연차 원장</span>
            </div>
          )}
        </div>

        {/* 하단 상세 필터 툴바 (근태 전용) */}
        {adminTab !== 'leave_ledger' && (
        <div className="flex flex-wrap items-center gap-2">
          {/* 부서 필터 */}
          <div className="flex items-center gap-1.5 text-xs text-ink3">
            <Building2 size={13} className="text-teal" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="h-8 rounded-lg border border-border bg-panel px-2 text-[11px] font-bold text-ink outline-none"
            >
              <option value="ALL">전체 부서 ({allPersonRows.length}명)</option>
              {deptList.map((d) => (
                <option key={d} value={d}>
                  {d} ({allPersonRows.filter((p) => p.dept === d).length}명)
                </option>
              ))}
            </select>
          </div>

          {/* 상태 필터 */}
          <div className="flex items-center gap-1.5 text-xs text-ink3">
            <Filter size={13} className="text-teal" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setOnlyAnomaly(false);
              }}
              className="h-8 rounded-lg border border-border bg-panel px-2 text-[11px] font-bold text-ink outline-none"
            >
              <option value="ALL">전체 근태 상태</option>
              <option value="present">정상 출근</option>
              <option value="late">지각 발생</option>
              <option value="absent">결근</option>
              <option value="leave">휴가 사용</option>
              <option value="missing">출·퇴근 미기록</option>
            </select>
          </div>

          {/* 관리 필요(이상자)만 보기 토글 버튼 */}
          <button
            type="button"
            onClick={() => setOnlyAnomaly((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all ${
              onlyAnomaly
                ? 'bg-rose-500 text-white border-rose-600 shadow-2xs ring-2 ring-rose-500/30'
                : 'border-border text-ink2 hover:border-rose-500/50 hover:bg-rose-500/10'
            }`}
          >
            <AlertTriangle size={12} className={onlyAnomaly ? 'text-white' : 'text-rose-500'} />
            <span>관리 필요만 보기 ({kpiStats.totalAnomaly}건)</span>
          </button>

          {/* 퇴직자 포함 토글 */}
          <label className="flex items-center gap-1 text-[11px] text-ink3 cursor-pointer select-none ml-1">
            <input
              type="checkbox"
              checked={showRetired}
              onChange={(e) => setShowRetired(e.target.checked)}
              className="rounded border-border"
            />
            <span>퇴직자 포함</span>
          </label>

          {/* 테스트 계정으로 조회 시에만 노출되는 테스트 부서 제외 토글 */}
          {isViewerTester && (
            <label className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 cursor-pointer select-none ml-1 transition-colors hover:bg-amber-500/15">
              <input
                type="checkbox"
                checked={excludeTestDept}
                onChange={(e) => setExcludeTestDept(e.target.checked)}
                className="rounded border-amber-500/40 text-amber-600 focus:ring-amber-500/30"
              />
              <span>테스트 부서 제외</span>
            </label>
          )}

          {/* 검색창 */}
          <div className="ml-auto flex items-center gap-1.5">
            <div className="relative">
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="이름 · 사번 · 부서 검색"
                className={`${searchInput} w-44 pl-7`}
              />
              <Search size={12} className="absolute left-2.5 top-2.5 text-ink3" />
            </div>
            {(selectedDept !== 'ALL' || statusFilter !== 'ALL' || onlyAnomaly || keyword) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDept('ALL');
                  setStatusFilter('ALL');
                  setOnlyAnomaly(false);
                  setKeyword('');
                }}
                className="text-[10.5px] font-bold text-ink3 hover:text-teal underline"
              >
                필터 초기화
              </button>
            )}
          </div>
        </div>
        )}
      </section>

      {/* 3. 4대 관제 View 전환 렌더링 */}
      {monthAllQuery.isLoading ? (
        <div className="grid min-h-72 place-items-center rounded-xl border border-border bg-panel text-xs text-ink3">
          전사 근태 데이터를 정밀 집계 중입니다…
        </div>
      ) : (
        <>
          {adminTab === 'all_matrix' && (
            <CommuteMatrixView
              month={month}
              rows={filteredPersonRows}
              onSelectPerson={(person) => setSelectedPersonDetail(person)}
              holidayMap={holidayMap}
            />
          )}

          {adminTab === 'dept_summary' && (
            <CommuteDeptView
              deptSummaries={deptSummaries}
              onDrillDownDept={handleDrillDownDept}
            />
          )}

          {adminTab === 'anomaly' && (
            <CommuteAnomalyView
              anomalies={anomalyItems}
              personMap={personMap}
              onSelectPerson={(person) => setSelectedPersonDetail(person)}
            />
          )}

          {adminTab === 'leave' && (
            <CommuteLeaveView
              month={month}
              approvals={approvalsQuery.data ?? []}
              personMap={personMap}
              onSelectPerson={(person) => setSelectedPersonDetail(person)}
            />
          )}

          {adminTab === 'leave_ledger' && canAll && (
            <div className="space-y-3">
              {/* 전사 연차 KPI 통계 바 */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                <StatCard
                  label="관리 인원"
                  value={`${leaveLedgerSummary.totalEmployees}명`}
                  sub="전사 임직원"
                />
                <StatCard
                  label="총 부여 연차"
                  value={`${leaveLedgerSummary.totalGranted}일`}
                  sub={`법정 ${leaveLedgerSummary.totalEntitled}일 + 조정`}
                  tone="border-teal/25 bg-teal/8"
                />
                <StatCard
                  label="총 사용 연차"
                  value={`${leaveLedgerSummary.totalUsed}일`}
                  sub="승인 완료 누적"
                  tone="border-emerald-500/25 bg-emerald-500/8"
                />
                <StatCard
                  label="평균 소진율"
                  value={`${leaveLedgerSummary.avgUsageRate}%`}
                  sub="부여 대비 사용"
                  tone="border-teal/25 bg-teal/8"
                />
                <StatCard
                  label="잔여 연차 합계"
                  value={`${leaveLedgerSummary.totalRemaining}일`}
                  sub={`신청중 ${leaveLedgerSummary.totalPending}일 제외`}
                />
              </div>

              {/* 전사 연차 원장 테이블 */}
              <LeaveLedgerTable
                entries={leaveLedgerEntries}
                calculationMode={ledgerMode}
                onToggleCalculationMode={setLedgerMode}
                onOpenAdjustment={(entry) => setAdjustmentTarget(entry)}
                isAdmin={canAll}
              />
            </div>
          )}
        </>
      )}

      {/* 4. 연차 수동 가감 모달 */}
      {adjustmentTarget && (
        <LeaveAdjustmentModal
          entry={adjustmentTarget}
          adminName={user?.name || '관리자'}
          onClose={() => setAdjustmentTarget(null)}
          onSuccess={() => {
            setAdjustments(getStoredAdjustments());
          }}
        />
      )}

      {/* 4. 직원 상세 슬라이드오버 (Drawer) */}
      <EmployeeDetailDrawer
        person={selectedPersonDetail}
        onClose={() => setSelectedPersonDetail(null)}
        month={month}
        holidayMap={holidayMap}
      />
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1560px] px-3 py-4 sm:px-5 sm:py-5 min-w-0 overflow-x-hidden">
      <GwHead
        icon="⏱️"
        name="근태·휴가"
        desc="출퇴근 기록 및 개인 연차·휴가 잔여 조회와 신청 내역을 통합 관리합니다."
        right={
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            {canManagePolicy && (
              <button
                type="button"
                onClick={() => setIsPolicyModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-panel-alt transition-colors shadow-2xs"
                title="출퇴근 시간 및 근무정책 설정"
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

      <div className="mt-4">
        {activeTab === LEAVE_TAB ? (
          <MyLeaveTab />
        ) : activeTab === ME_TAB ? (
          myCommutePanel
        ) : (
          adminControlPanel
        )}
      </div>

      <CommutePolicyModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        policy={policy}
        onSave={savePolicy}
      />
    </div>
  );
}
