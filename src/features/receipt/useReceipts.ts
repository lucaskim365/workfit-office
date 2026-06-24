import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { receiptRepo, type ReceiptFilter } from '@/data/receipt/receipt.repo';
import { receivingService } from '@/services/receiving.service';

/** 입고 데이터 훅 — 조회 + 입고 처리(cross-entity). ([[data-layer-pattern]]) */
const KEY = 'receipts';

export function useReceipts(filter?: ReceiptFilter) {
  return useQuery({ queryKey: [KEY, filter ?? null], queryFn: () => receiptRepo.list(filter) });
}

/** 입고 처리 — 입고·재고 캐시 모두 무효화. */
export function useReceive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ po, at }: { po: string; at: string }) => receivingService.receiveRemaining(po, at),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}
