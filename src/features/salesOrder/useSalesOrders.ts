import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { salesOrderRepo, type SoFilter } from '@/data/salesOrder/salesOrder.repo';
import type { SalesOrder } from '@/domain/salesOrder/schema';

/** 수주 데이터 훅. ([[data-layer-pattern]]) */
const KEY = 'salesOrders';

export function useSalesOrders(filter?: SoFilter) {
  return useQuery({ queryKey: [KEY, filter ?? null], queryFn: () => salesOrderRepo.list(filter) });
}

export function useCreateSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: Omit<SalesOrder, 'no'>) => salesOrderRepo.create(draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 납품 기록 — 라인별 납품량 가산(납품상태 자동 도출). */
export function useRecordDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, deliveries }: { no: string; deliveries: Record<string, number> }) =>
      salesOrderRepo.recordDelivery(no, deliveries),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
