import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workOrderRepo, type WoFilter } from '@/data/workOrder/workOrder.repo';
import type { WorkOrderDraft, WoStatus } from '@/domain/workOrder/schema';

/**
 * 작업지시 데이터 훅 — 조회 + 채번 발행 + 상태 전이.
 * ([[data-layer-pattern]] 정본 패턴)
 */
const KEY = 'workOrders';

export function useWorkOrders(filter?: WoFilter) {
  return useQuery({ queryKey: [KEY, filter ?? null], queryFn: () => workOrderRepo.list(filter) });
}

export function useCreateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: WorkOrderDraft) => workOrderRepo.create(draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useTransitionWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, to, at }: { no: string; to: WoStatus; at: string }) =>
      workOrderRepo.transition(no, to, at),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
