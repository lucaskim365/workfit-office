import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalRouteRepo } from '@/data/approvalRoute/approvalRoute.repo';
import type { ApprovalRouteRule } from '@/domain/approvalRoute/schema';

/**
 * 동적 결재선 룰 마스터 훅 — 기준정보 결재선 규칙관리 CRUD.
 * 룰 엔진(useRouteEngine)과 캐시 공유('approvalRouteRules') → 저장 즉시 상신에 반영.
 */
const KEY = 'approvalRouteRules';

export function useRouteRules() {
  return useQuery({ queryKey: [KEY], queryFn: () => approvalRouteRepo.list() });
}

export function useUpsertRouteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (r: ApprovalRouteRule) => approvalRouteRepo.save(r),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRemoveRouteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approvalRouteRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
