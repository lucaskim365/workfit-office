import {
  calculateEmploymentPeriod,
  calculateStatutoryEntitlement,
  evaluateAdvanceLeaveOffset,
  calculateFiscalYearEntitlement,
  type AdvanceOffsetResult,
} from './accrualEngine';
import { normalizeLegacyLeaveDoc } from './legacyAdapter';
import type { LeaveAdjustmentTransaction } from './adjustmentStore';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import type { EmployeeProfile } from '@/domain/employeeProfile/schema';

export interface LeaveLedgerEntry {
  empId?: number | null;
  empNo: string;
  name: string;
  dept: string;
  position: string;
  hireDate: string; // YYYY-MM-DD
  serviceYears: number;
  serviceMonths: number;
  isUnderOneYear: boolean;

  // 연차 일수 계산
  entitledDays: number; // 법정 발생 연차
  adjustedDays: number; // 수동 가감 (+/-)
  totalGrantedDays: number; // 총 부여 (발생 + 조정)
  usedDays: number; // 결재 승인 완료
  pendingDays: number; // 결재 진행 중
  remainingDays: number; // 순 잔여 일수
  usageRate: number; // 소진율 (%)

  // 선사용/상계 상태
  advanceStatus: AdvanceOffsetResult;

  // 상세 이력 링크
  leaveHistory: Array<{
    docId: string;
    title: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    daysCount: number;
    status: '완료' | '진행중';
    createdAt: string;
  }>;
  adjustmentHistory: LeaveAdjustmentTransaction[];
}

export interface LeaveLedgerSummary {
  totalEmployees: number;
  totalEntitled: number;
  totalAdjusted: number;
  totalGranted: number;
  totalUsed: number;
  totalPending: number;
  totalRemaining: number;
  avgUsageRate: number;
  advanceEmployeeCount: number;
}

export interface BuildLedgerOptions {
  referenceDate?: Date; // 기준일 (기본값: 오늘)
  mode?: 'HIRE_DATE' | 'FISCAL_YEAR'; // 산정 방식 (기본값: HIRE_DATE 입사일 기준)
}

const norm = (s?: string | null) => (s || '').replace(/\s+/g, '');

/**
 * 전사 임직원 연차 원장 빌더 (순수 함수)
 *
 * DB 불변성을 유지하며, 사원 프로필 + 전자결재 내역 + 수동 가감 트랜잭션을 종합 결합합니다.
 */
export function buildLeaveLedger(
  employees: Array<{
    empId?: number | null;
    empNo?: string | null;
    name: string;
    dept?: string | null;
    position?: string | null;
    hireDate?: string | null;
  }>,
  profiles: EmployeeProfile[] = [],
  approvalDocs: ApprovalDoc[] = [],
  adjustments: LeaveAdjustmentTransaction[] = [],
  options: BuildLedgerOptions = {},
): { entries: LeaveLedgerEntry[]; summary: LeaveLedgerSummary } {
  const refDate = options.referenceDate ?? new Date();
  const refDateStr = refDate.toISOString().slice(0, 10);
  const mode = options.mode ?? 'HIRE_DATE';

  // 1. 프로필 맵 (이름/사번 기준 매핑)
  const profileMap = new Map<string, EmployeeProfile>();
  for (const p of profiles) {
    if (p.name) profileMap.set(norm(p.name), p);
    if (p.empNo) profileMap.set(String(p.empNo), p);
  }

  // 2. 가감 트랜잭션 맵
  const adjMap = new Map<string, LeaveAdjustmentTransaction[]>();
  for (const tx of adjustments) {
    const key = norm(tx.empName);
    if (!adjMap.has(key)) adjMap.set(key, []);
    adjMap.get(key)!.push(tx);
  }

  // 3. 결재 문서 정규화 및 사원별 집계
  const leaveDocsByEmp = new Map<
    string,
    Array<{
      docId: string;
      title: string;
      leaveType: string;
      startDate: string;
      endDate: string;
      daysCount: number;
      status: '완료' | '진행중';
      createdAt: string;
    }>
  >();

  for (const doc of approvalDocs) {
    if (doc.docType !== '휴가') continue;
    if (doc.status !== '완료' && doc.status !== '진행중') continue;

    const normalized = normalizeLegacyLeaveDoc(doc);
    if (!normalized) continue;

    const drafterKey = norm(normalized.drafterName);
    if (!drafterKey) continue;

    if (!leaveDocsByEmp.has(drafterKey)) {
      leaveDocsByEmp.set(drafterKey, []);
    }

    leaveDocsByEmp.get(drafterKey)!.push({
      docId: normalized.docId,
      title: doc.title,
      leaveType: normalized.leaveType,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      daysCount: normalized.days,
      status: normalized.status as '완료' | '진행중',
      createdAt: normalized.createdAt || '',
    });
  }

  // 4. 사원별 연차 원장 엔트리 생성
  const entries: LeaveLedgerEntry[] = [];

  for (const emp of employees) {
    const empName = (emp.name || '').trim();
    if (!empName) continue;
    const key = norm(empName);

    // 입사일 확정 (emp.hireDate 우선, 없으면 프로필 대조, 없으면 기본값)
    const profile = profileMap.get(key) ?? (emp.empNo ? profileMap.get(String(emp.empNo)) : undefined);
    const hireDate = (emp.hireDate || profile?.hireDate || '2026-01-01').slice(0, 10);

    const period = calculateEmploymentPeriod(hireDate, refDateStr);

    // 법정 발생 일수 계산
    let entitledDays = 0;
    if (mode === 'FISCAL_YEAR') {
      const fy = calculateFiscalYearEntitlement(hireDate, refDate.getFullYear());
      entitledDays = fy.regularGrantDays > 0 ? fy.regularGrantDays : fy.proRataGrantDays;
    } else {
      const statutory = calculateStatutoryEntitlement(hireDate, refDateStr);
      entitledDays = statutory.totalStatutoryGranted;
    }

    // 수동 가감 합산
    const empAdjs = adjMap.get(key) ?? [];
    const adjustedDays = empAdjs.reduce((sum, tx) => sum + tx.deltaDays, 0);
    const totalGrantedDays = Math.max(0, entitledDays + adjustedDays);

    // 휴가 사용 일수 합산
    const empLeaves = leaveDocsByEmp.get(key) ?? [];
    let usedDays = 0;
    let pendingDays = 0;

    for (const l of empLeaves) {
      if (l.status === '완료') {
        usedDays += l.daysCount;
      } else if (l.status === '진행중') {
        pendingDays += l.daysCount;
      }
    }

    // 순 잔여 일수
    const remainingDays = Number((totalGrantedDays - usedDays - pendingDays).toFixed(2));
    const usageRate = totalGrantedDays > 0 ? Math.min(100, Math.round((usedDays / totalGrantedDays) * 100)) : 0;

    // 선사용 상계 평가 (1년 미만 신입사원 대상)
    const advanceStatus = evaluateAdvanceLeaveOffset(hireDate, refDateStr, usedDays);

    entries.push({
      empId: emp.empId ?? null,
      empNo: String(emp.empNo || profile?.empNo || '—'),
      name: empName,
      dept: emp.dept || profile?.dept || '소속 미지정',
      position: emp.position || profile?.position || '사원',
      hireDate,
      serviceYears: period.fullYears,
      serviceMonths: period.fullMonths,
      isUnderOneYear: !period.isOverOneYear,
      entitledDays,
      adjustedDays,
      totalGrantedDays,
      usedDays,
      pendingDays,
      remainingDays,
      usageRate,
      advanceStatus,
      leaveHistory: empLeaves.sort((a, b) => b.startDate.localeCompare(a.startDate)),
      adjustmentHistory: empAdjs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  }

  // 부서명 및 성명 순 정렬
  entries.sort((a, b) => {
    const deptCmp = a.dept.localeCompare(b.dept, 'ko');
    if (deptCmp !== 0) return deptCmp;
    return a.name.localeCompare(b.name, 'ko');
  });

  // 5. 전사 요약 통계 집계
  const totalEmployees = entries.length;
  const totalEntitled = Number(entries.reduce((s, e) => s + e.entitledDays, 0).toFixed(2));
  const totalAdjusted = Number(entries.reduce((s, e) => s + e.adjustedDays, 0).toFixed(2));
  const totalGranted = Number(entries.reduce((s, e) => s + e.totalGrantedDays, 0).toFixed(2));
  const totalUsed = Number(entries.reduce((s, e) => s + e.usedDays, 0).toFixed(2));
  const totalPending = Number(entries.reduce((s, e) => s + e.pendingDays, 0).toFixed(2));
  const totalRemaining = Number(entries.reduce((s, e) => s + e.remainingDays, 0).toFixed(2));
  const avgUsageRate = totalGranted > 0 ? Math.round((totalUsed / totalGranted) * 100) : 0;
  const advanceEmployeeCount = entries.filter((e) => e.advanceStatus.isAdvanceUsed).length;

  const summary: LeaveLedgerSummary = {
    totalEmployees,
    totalEntitled,
    totalAdjusted,
    totalGranted,
    totalUsed,
    totalPending,
    totalRemaining,
    avgUsageRate,
    advanceEmployeeCount,
  };

  return { entries, summary };
}
