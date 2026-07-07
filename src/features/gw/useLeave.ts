import { useMemo } from 'react';
import { useAllApprovals } from '@/features/gw/useApprovals';
import { byRecent } from '@/domain/approvalDoc/engine';
import type { ApprovalDoc, LeaveType } from '@/domain/approvalDoc/schema';

/**
 * 휴가 데이터 훅 — 휴가는 별도 도메인이 아니라 `docType='휴가'` 결재 문서다(§5.4).
 * 잔여일수는 저장하지 않고 **도출**한다: 부여일수 − 승인완료된 휴가 days 합.
 * ([[data-layer-pattern]] 파생상태 원칙 · docs/전자결재_워크플로_개발_계획서.md §5.4·§7.4)
 */

/**
 * 연차 부여일수(데모 정책 스텁). 실제로는 부서·직급·근속 정책 seed 로 확장.
 * 연차·반차만 이 부여에서 차감하고, 병가·경조·공가는 별도(부여 무관) 집계.
 */
export const ANNUAL_GRANT = 15;

/** 연차 잔여에서 차감하는 휴가 종류. */
const DEDUCTS_ANNUAL = (t: LeaveType) => t === '연차' || t === '반차';

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
  /** 내 휴가 문서(최근순). */
  myDocs: ApprovalDoc[];
  isLoading: boolean;
}

export function useLeave(userId: string | undefined): LeaveBalance {
  const q = useAllApprovals();
  return useMemo(() => {
    const rows = q.data ?? [];
    const mine = userId
      ? rows.filter((d) => d.docType === '휴가' && d.drafterId === userId).sort(byRecent)
      : [];
    const sumDays = (pred: (d: ApprovalDoc) => boolean) =>
      mine.filter((d) => d.form && pred(d)).reduce((s, d) => s + (d.form?.days ?? 0), 0);

    const used = sumDays((d) => d.status === '완료' && DEDUCTS_ANNUAL(d.form!.leaveType));
    const pending = sumDays((d) => d.status === '진행중' && DEDUCTS_ANNUAL(d.form!.leaveType));
    const otherUsed = sumDays((d) => d.status === '완료' && !DEDUCTS_ANNUAL(d.form!.leaveType));

    return {
      grant: ANNUAL_GRANT,
      used,
      pending,
      remaining: ANNUAL_GRANT - used,
      otherUsed,
      myDocs: mine,
      isLoading: q.isLoading,
    };
  }, [q.data, q.isLoading, userId]);
}
