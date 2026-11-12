import { useCallback, useMemo } from 'react';
import { useAllApprovals } from '@/features/gw/useApprovals';
import { useHolidays } from '@/features/holiday/useHolidays';
import { useCommutePolicy } from './useCommutePolicy';
import { DEFAULT_COMMUTE_POLICY } from '@/domain/commutePolicy/schema';
import type { CommuteRecord, CommuteStatus } from '@/domain/commute/schema';
import { evaluateCommuteRecord } from '@/domain/commute/engine';
import { buildApprovalDayIndex, type ApprovalDayMap } from '@/domain/commute/approvalDayIndex';
import { useOutsideWorks } from '@/features/outsideWork/useOutsideWorks';
import { useScheduleChanges } from '@/features/scheduleChange/useScheduleChanges';

export type CommuteRawRecord = {
  empId: number;
  date: string;
  inAt: string | null;
  outAt: string | null;
  status?: CommuteStatus;
};

/**
 * 근태 판정 공용 진입점 — 데스크톱·PWA 모든 근태 화면이 이것만 쓴다.
 * 정책(DB)·공휴일·승인 결재(휴가·외근·출장)·직접 등록 외근·출장을 모아 evaluateCommuteRecord 로 다시 판정하며,
 * CAPS가 적재 시 추정한 status 는 판정에 쓰지 않는다.
 */
export function useCommuteEvaluation() {
  const { policy = DEFAULT_COMMUTE_POLICY } = useCommutePolicy();
  // 로딩 중 기본값을 렌더마다 새로 만들면 이것을 쓰는 계산(연차 원장 등)이 매번 다시 돈다
  const holidaysQuery = useHolidays();
  const holidays = useMemo(() => holidaysQuery.data ?? [], [holidaysQuery.data]);
  const approvalsQuery = useAllApprovals();
  const outsideWorksQuery = useOutsideWorks();
  const scheduleChanges = useScheduleChanges();

  const holidayMap = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);
  const approvalIndex = useMemo(
    () => buildApprovalDayIndex(approvalsQuery.data ?? [], outsideWorksQuery.data ?? [], scheduleChanges),
    [approvalsQuery.data, outsideWorksQuery.data, scheduleChanges],
  );

  /** 사람(사용자 id·이름)의 날짜별 승인 일정 — 한 사람에 대해 한 번 구해 여러 날짜 판정에 재사용 */
  const approvalDaysOf = useCallback(
    (person: { id?: string | null; name?: string | null }) => approvalIndex.lookup(person),
    [approvalIndex],
  );

  const evaluate = useCallback(
    (raw: CommuteRawRecord, approvalDays: ApprovalDayMap, hireDate?: string | null): CommuteRecord =>
      evaluateCommuteRecord(raw, policy, approvalDays, hireDate, holidayMap),
    [policy, holidayMap],
  );

  return {
    policy,
    holidays,
    holidayMap,
    approvals: approvalsQuery.data,
    isApprovalsLoading: approvalsQuery.isLoading || outsideWorksQuery.isLoading,
    approvalDaysOf,
    evaluate,
  };
}
