import { useMemo } from 'react';
import { useApprovalBoxes } from '@/features/gw/useApprovals';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { currentApproverIds } from '@/domain/approvalDoc/engine';

/**
 * 도크 그룹웨어 요약 — 로그인 사용자의 **결재 대기** 집계(도출값).
 * GroupwarePanel 의 전자결재 타일 배지·"결재 대기" 카드를 실데이터로 구동한다.
 * (docs/전자결재_워크플로_개발_계획서.md §4.5 · §7.5)
 */
export interface GwSummary {
  /** 내가 지금 결재해야 하는 문서 수(도크 배지). */
  pendingCount: number;
  /** 대기 문서(최근순) — 도크 카드 미리보기. */
  pendingDocs: ApprovalDoc[];
  isLoading: boolean;
}

export function useGwSummary(userId: string | undefined): GwSummary {
  const { byBox, isLoading } = useApprovalBoxes(userId);

  const activePendingDocs = useMemo(() => {
    const list = byBox['대기'] ?? [];
    return userId ? list.filter((d) => currentApproverIds(d).includes(userId)) : [];
  }, [byBox, userId]);

  return {
    pendingCount: activePendingDocs.length,
    pendingDocs: activePendingDocs,
    isLoading,
  };
}
