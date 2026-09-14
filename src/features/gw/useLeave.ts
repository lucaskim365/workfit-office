import { useMemo, useState, useEffect } from 'react';
import { useAllApprovals } from '@/features/gw/useApprovals';
import { useEmployeeProfiles } from '@/features/employeeProfile/useEmployeeProfiles';
import { byRecent } from '@/domain/approvalDoc/engine';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import {
  calculateStatutoryEntitlement,
  evaluateAdvanceLeaveOffset,
  type StatutoryLeaveResult,
  type AdvanceOffsetResult,
} from '@/domain/leave/accrualEngine';
import { isAnnualLeaveDeduction } from '@/domain/leave/policy';
import { normalizeLegacyLeaveDoc, type NormalizedLeaveRecord } from '@/domain/leave/legacyAdapter';
import {
  getSubstituteHolidaysForUser,
  SUBSTITUTE_HOLIDAY_UPDATED_EVENT,
} from '@/domain/leave/substituteHolidayStore';

export const FALLBACK_ANNUAL_GRANT = 15;

export interface SubstituteHolidayItem {
  id: string;
  occurrenceDate: string;
  expirationDate: string;
  reason: string;
  days: number;
  used: number;
  pending: number;
  status: 'USED' | 'AVAILABLE' | 'EXPIRED';
}

export interface LeaveBalance {
  /** 법정 부여 총 일수 (엔진 산출) */
  grant: number;
  /** 승인완료된 연차·반차 사용 합. */
  used: number;
  /** 진행중(미확정) 연차·반차 합. */
  pending: number;
  /** 잔여 = 부여 − 사용. */
  remaining: number;
  /** 연차 차감 제외 승인완료 휴가(공가·경조 등) 합. */
  otherUsed: number;

  /** 법정 연차 계산 상세 (입사일이 있는 경우) */
  statutory?: StatutoryLeaveResult;
  /** 연차 선사용 및 상계 판정 (입사일 및 사용일수 기반) */
  advanceOffset?: AdvanceOffsetResult;
  /** 입사일자 (YYYY-MM-DD) */
  hireDate?: string;

  /** 대체휴무(대휴) 현황 */
  substituteHoliday: {
    total: number;
    used: number;
    pending: number;
    remaining: number;
    expiringSoonCount: number;
    detailList: SubstituteHolidayItem[];
  };

  /** 내 휴가 문서(최근순). */
  myDocs: ApprovalDoc[];
  isLoading: boolean;
}

export function useLeave(userId: string | undefined): LeaveBalance {
  const q = useAllApprovals();
  const profilesQ = useEmployeeProfiles();

  // 대체휴무 실시간 동기화 상태 리스너
  const [subUpdateVer, setSubUpdateVer] = useState(0);
  useEffect(() => {
    const onSubUpdate = () => setSubUpdateVer((v) => v + 1);
    if (typeof window !== 'undefined') {
      window.addEventListener(SUBSTITUTE_HOLIDAY_UPDATED_EVENT, onSubUpdate);
      return () => window.removeEventListener(SUBSTITUTE_HOLIDAY_UPDATED_EVENT, onSubUpdate);
    }
  }, []);

  return useMemo(() => {
    const rows = q.data ?? [];
    const mine = userId
      ? rows.filter((d) => d.docType === '휴가' && d.drafterId === userId).sort(byRecent)
      : [];

    // 전사 단일 정규화 어댑터를 통해 기결재 및 신규 문서 일괄 정규화 (SSOT 보장)
    const myNormalizedLeaves = mine
      .map(normalizeLegacyLeaveDoc)
      .filter((d): d is NormalizedLeaveRecord => d !== null);

    // 연차/반차/반반차 (법정 연차 차감 대상)
    const used = myNormalizedLeaves
      .filter((d) => d.status === '완료' && isAnnualLeaveDeduction(d.leaveType))
      .reduce((s, d) => s + d.days, 0);

    const pending = myNormalizedLeaves
      .filter((d) => d.status === '진행중' && isAnnualLeaveDeduction(d.leaveType))
      .reduce((s, d) => s + d.days, 0);

    const otherUsed = myNormalizedLeaves
      .filter((d) => d.status === '완료' && !isAnnualLeaveDeduction(d.leaveType) && d.leaveType !== '대체휴무')
      .reduce((s, d) => s + d.days, 0);

    // 대체휴무 실시간 결재 문서 집계
    const approvedSubDays = myNormalizedLeaves
      .filter((d) => d.status === '완료' && d.leaveType === '대체휴무')
      .reduce((s, d) => s + d.days, 0);

    const pendingSubDays = myNormalizedLeaves
      .filter((d) => d.status === '진행중' && d.leaveType === '대체휴무')
      .reduce((s, d) => s + d.days, 0);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysLaterStr = `${thirtyDaysLater.getFullYear()}-${String(thirtyDaysLater.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysLater.getDate()).padStart(2, '0')}`;

    // 임직원 인사 프로필에서 hireDate 조회 및 법정 연차 엔진 산출
    const userProfile = profilesQ.data?.find((p) => p.userId === userId || p.id === userId);
    const hireDate = userProfile?.hireDate || undefined;

    let statutory: StatutoryLeaveResult | undefined;
    let advanceOffset: AdvanceOffsetResult | undefined;
    let dynamicGrant = FALLBACK_ANNUAL_GRANT;

    if (hireDate) {
      statutory = calculateStatutoryEntitlement(hireDate, todayStr);
      dynamicGrant = statutory.totalStatutoryGranted;
      advanceOffset = evaluateAdvanceLeaveOffset(hireDate, todayStr, used);
    }

    // 선입선출(FIFO) 기반 대체휴무 상태 분배 및 차감 로직
    let remainingApprovedToAllocate = approvedSubDays;
    let remainingPendingToAllocate = pendingSubDays;

    const userName = userProfile?.name ?? mine[0]?.drafterName;
    const userSubHolidays = getSubstituteHolidaysForUser(userId, userName, hireDate);

    const detailList: SubstituteHolidayItem[] = userSubHolidays.map((item) => {
      const isExpired = item.expirationDate < todayStr;
      
      let itemUsed = 0;
      let itemPending = 0;

      if (!isExpired) {
        // 완료 건 분배
        if (remainingApprovedToAllocate > 0) {
          const allocate = Math.min(item.days, remainingApprovedToAllocate);
          itemUsed = allocate;
          remainingApprovedToAllocate -= allocate;
        }
        // 진행중 건 분배
        if (remainingPendingToAllocate > 0) {
          const availableForPending = item.days - itemUsed;
          const allocate = Math.min(availableForPending, remainingPendingToAllocate);
          itemPending = allocate;
          remainingPendingToAllocate -= allocate;
        }
      }

      let status: 'USED' | 'AVAILABLE' | 'EXPIRED' = 'AVAILABLE';
      if (isExpired) {
        status = 'EXPIRED';
      } else if (itemUsed >= item.days) {
        status = 'USED';
      }

      return {
        ...item,
        used: itemUsed,
        pending: itemPending,
        status,
      };
    });

    // 대체휴무 요약 계산
    const activeItems = detailList.filter(item => item.status !== 'EXPIRED');
    const subTotal = activeItems.reduce((acc, cur) => acc + cur.days, 0);
    const subUsed = activeItems.reduce((acc, cur) => acc + cur.used, 0);
    const subPending = activeItems.reduce((acc, cur) => acc + cur.pending, 0);
    const subRemaining = Math.max(0, subTotal - subUsed - subPending);

    // 30일 내 만료 예정인 사용 가능한 대체휴무 계산
    const expiringSoonCount = activeItems.filter(
      (item) =>
        item.status === 'AVAILABLE' &&
        item.used + item.pending < item.days &&
        item.expirationDate <= thirtyDaysLaterStr &&
        item.expirationDate >= todayStr
    ).length;

    return {
      grant: dynamicGrant,
      used,
      pending,
      remaining: Math.max(0, dynamicGrant - used),
      otherUsed,
      statutory,
      advanceOffset,
      hireDate,
      substituteHoliday: {
        total: subTotal,
        used: subUsed,
        pending: subPending,
        remaining: subRemaining,
        expiringSoonCount,
        detailList,
      },
      myDocs: mine,
      isLoading: q.isLoading || profilesQ.isLoading,
    };
  }, [q.data, q.isLoading, profilesQ.data, profilesQ.isLoading, userId, subUpdateVer]);
}
