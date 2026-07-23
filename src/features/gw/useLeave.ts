import { useMemo } from 'react';
import { useAllApprovals } from '@/features/gw/useApprovals';
import { byRecent } from '@/domain/approvalDoc/engine';
import type { ApprovalDoc, LeaveType } from '@/domain/approvalDoc/schema';

export const ANNUAL_GRANT = 15;

const DEDUCTS_ANNUAL = (t: LeaveType) => t === '연차' || t === '반차';

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
  grant: number;
  /** 승인완료된 연차·반차 사용 합. */
  used: number;
  /** 진행중(미확정) 연차·반차 합. */
  pending: number;
  /** 잔여 = 부여 − 사용. */
  remaining: number;
  /** 병가·경조·공가 등 기타 승인완료 일수 합(부여 무관, 참고 표시). */
  otherUsed: number;

  /** 대체휴무 요약 및 내역 */
  substituteHoliday: {
    total: number;       // 총 발생 (유효한 건들의 총합 + 이미 사용 완료된 건들의 총합)
    used: number;        // 결재 완료된 대체휴무 사용량
    pending: number;     // 진행 중인 대체휴무 신청량
    remaining: number;   // 사용 가능 잔여 일수 (유효기간 내)
    expiringSoonCount: number; // 30일 이내 만료 예정 건수
    detailList: SubstituteHolidayItem[];
  };

  /** 내 휴가 문서(최근순). */
  myDocs: ApprovalDoc[];
  isLoading: boolean;
}

// 모의 대체휴무 발생 데이터 삭제됨
const INITIAL_SUBSTITUTE_HOLIDAYS: Array<{ id: string; occurrenceDate: string; expirationDate: string; reason: string; days: number }> = [];

export function useLeave(userId: string | undefined): LeaveBalance {
  const q = useAllApprovals();
  return useMemo(() => {
    const rows = q.data ?? [];
    const mine = userId
      ? rows.filter((d) => d.docType === '휴가' && d.drafterId === userId).sort(byRecent)
      : [];

    const sumDays = (pred: (d: ApprovalDoc) => boolean) =>
      mine.filter((d) => d.form && pred(d)).reduce((s, d) => s + (d.form?.days ?? 0), 0);

    // 연차/반차
    const used = sumDays((d) => d.status === '완료' && DEDUCTS_ANNUAL(d.form!.leaveType));
    const pending = sumDays((d) => d.status === '진행중' && DEDUCTS_ANNUAL(d.form!.leaveType));
    const otherUsed = sumDays((d) => d.status === '완료' && !DEDUCTS_ANNUAL(d.form!.leaveType) && d.form!.leaveType !== '대체휴무');

    // 대체휴무 실시간 결재 문서 집계
    const approvedSubDays = sumDays((d) => d.status === '완료' && d.form!.leaveType === '대체휴무');
    const pendingSubDays = sumDays((d) => d.status === '진행중' && d.form!.leaveType === '대체휴무');

    const todayStr = '2026-07-16';
    const thirtyDaysLaterStr = '2026-08-15'; // 30일 이내 만료 예정 검사용 (대략 2026-08-15)

    // 선입선출(FIFO) 기반 대체휴무 상태 분배 및 차감 로직
    let remainingApprovedToAllocate = approvedSubDays;
    let remainingPendingToAllocate = pendingSubDays;

    const detailList: SubstituteHolidayItem[] = INITIAL_SUBSTITUTE_HOLIDAYS.map((item) => {
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
      grant: ANNUAL_GRANT,
      used,
      pending,
      remaining: Math.max(0, ANNUAL_GRANT - used),
      otherUsed,
      substituteHoliday: {
        total: subTotal,
        used: subUsed,
        pending: subPending,
        remaining: subRemaining,
        expiringSoonCount,
        detailList,
      },
      myDocs: mine,
      isLoading: q.isLoading,
    };
  }, [q.data, q.isLoading, userId]);
}
