import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { issueRepo } from '@/data/issue/issue.repo';
import { issuingService } from '@/services/issuing.service';

/** 불출 데이터 훅 — 조회 + 불출 완료(cross-entity). ([[data-layer-pattern]]) */
const KEY = 'issues';

export function useIssues() {
  return useQuery({ queryKey: [KEY], queryFn: () => issueRepo.list() });
}

/** 불출 완료 — 불출·재고 캐시 모두 무효화. */
export function useCompleteIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, at }: { no: string; at: string }) => issuingService.completeIssue(no, at),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}
