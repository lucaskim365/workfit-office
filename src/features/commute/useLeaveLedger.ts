import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildLeaveLedger, type LeaveLedgerEntry, type LeaveLedgerSummary } from '@/domain/leave/ledger';
import { getStoredAdjustments, type LeaveAdjustmentTransaction } from '@/domain/leave/adjustmentStore';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { SUBSTITUTE_LEDGER_UPDATED_EVENT, substituteLedgerStore } from '@/data/substituteLedger/substituteLedger.repo';
import { normName, type CommuteRoster } from './useCommuteRoster';

export type LeaveLedgerMode = 'HIRE_DATE' | 'FISCAL_YEAR';

const EMPTY_SUMMARY: LeaveLedgerSummary = {
  totalEmployees: 0,
  totalEntitled: 0,
  totalAdjusted: 0,
  totalGranted: 0,
  totalUsed: 0,
  totalPending: 0,
  totalRemaining: 0,
  avgUsageRate: 0,
  advanceEmployeeCount: 0,
};

/**
 * 전사 연차 원장 — 근태 관리 대상 전원의 부여·사용·잔여(웹 근태 화면·PWA 근태 관제 공용).
 * enabled 가 아니면(전사 권한이 없으면) 비어 있다. 수동 가감 내역은 다른 화면에서 바뀌면 다시 읽는다.
 */
export function useLeaveLedger({
  enabled,
  mode,
  roster,
  approvals,
  holidays,
}: {
  enabled: boolean;
  mode: LeaveLedgerMode;
  roster: CommuteRoster;
  approvals: ApprovalDoc[];
  holidays: Array<{ date: string; name?: string }>;
}): { entries: LeaveLedgerEntry[]; summary: LeaveLedgerSummary; refreshAdjustments: () => void } {
  const [adjustments, setAdjustments] = useState<LeaveAdjustmentTransaction[]>(() => getStoredAdjustments());
  const refreshAdjustments = useCallback(() => setAdjustments(getStoredAdjustments()), []);

  useEffect(() => {
    window.addEventListener('workfit-leave-adjustment-updated', refreshAdjustments);
    return () => window.removeEventListener('workfit-leave-adjustment-updated', refreshAdjustments);
  }, [refreshAdjustments]);

  const [subVer, setSubVer] = useState(0);
  useEffect(() => {
    const on = () => setSubVer((v) => v + 1);
    window.addEventListener(SUBSTITUTE_LEDGER_UPDATED_EVENT, on);
    return () => window.removeEventListener(SUBSTITUTE_LEDGER_UPDATED_EVENT, on);
  }, []);

  const { employees, userByEmpMap, isExcludedAttendance, getHireDateForEmp, employeeProfiles, compareEmployees } = roster;
  const ledger = useMemo(() => {
    if (!enabled) return { entries: [] as LeaveLedgerEntry[], summary: EMPTY_SUMMARY };
    const userOf = (e: { name: string; empId: number }) =>
      userByEmpMap.get(e.name.trim()) ?? userByEmpMap.get(normName(e.name)) ?? userByEmpMap.get(String(e.empId));
    const empInput = employees
      .filter((e) => !isExcludedAttendance(userOf(e), e.name))
      .map((e) => {
        const u = userOf(e);
        return {
          empId: e.empId,
          empNo: u?.empNo ? String(u.empNo) : String(e.empId),
          name: e.name,
          dept: u?.dept || null,
          position: u?.position || null,
          hireDate: getHireDateForEmp(e.name, e.empId),
          isRetired: !e.active || u?.status === '미사용' || Boolean(u?.resignedAt),
        };
      });
    const result = buildLeaveLedger(empInput, employeeProfiles, approvals, adjustments, { mode, holidays, substituteLedger: substituteLedgerStore.getAll() });
    return { entries: result.entries.sort(compareEmployees), summary: result.summary };
  }, [enabled, employees, userByEmpMap, isExcludedAttendance, getHireDateForEmp, employeeProfiles, approvals, adjustments, mode, holidays, compareEmployees, subVer]);

  return { ...ledger, refreshAdjustments };
}
