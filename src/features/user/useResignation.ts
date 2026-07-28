import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userRepo } from '@/data/user/user.repo';
import { approvalDocRepo } from '@/data/approvalDoc/approvalDoc.repo';
import { isActiveApprover } from '@/domain/approvalDoc/engine';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';

/**
 * 퇴사 처리(Phase 1) React 바인딩. ([[data-layer-pattern]])
 */

/**
 * 퇴사 대상자가 **현재 활성 결재자**인 진행중 문서 목록 —
 * 퇴사 시 결재가 정체될 위험이 있어 관리자에게 사전 경고용.
 */
export function useBlockingApprovals(userId: string | undefined) {
  return useQuery({
    queryKey: ['blockingApprovals', userId ?? null],
    queryFn: async (): Promise<ApprovalDoc[]> => {
      if (!userId) return [];
      const all = await approvalDocRepo.list();
      return all.filter((d) => d.status === '진행중' && isActiveApprover(d, userId));
    },
    enabled: !!userId,
  });
}

/** 퇴사 처리 실행 — 계정 비활성화 + 상급자 체인 재연결. */
export function useResignUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => userRepo.resign(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['blockingApprovals'] });
    },
  });
}
