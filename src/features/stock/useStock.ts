import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stockRepo, type MovementFilter } from '@/data/stock/stock.repo';
import type { StockMovement } from '@/domain/stock/schema';

/**
 * 재고 데이터 훅 — 현재고(도출) + 원장 + 변동기록.
 * ([[data-layer-pattern]] 정본 패턴)
 */
const KEY = 'stock';

/** 현재고 스냅샷(원장에서 도출). */
export function useStocks() {
  return useQuery({ queryKey: [KEY, 'snapshot'], queryFn: () => stockRepo.getStocks() });
}

/** 재고 원장(필터). */
export function useStockMovements(filter?: MovementFilter) {
  return useQuery({ queryKey: [KEY, 'movements', filter ?? null], queryFn: () => stockRepo.listMovements(filter) });
}

/** 재고 변동 기록 — 성공 시 현재고·원장 캐시 모두 무효화. */
export function useAddMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: Omit<StockMovement, 'id'> & { id?: string }) => stockRepo.addMovement(m),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
