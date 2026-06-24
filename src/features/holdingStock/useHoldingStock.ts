import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { holdingStockRepo, type HoldingStockFilter } from '@/data/holdingStock/holdingStock.repo';
import type { HoldingStock } from '@/domain/holdingStock/schema';

/**
 * 입고 보류 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'holdingStock';

/** 입고 보류 목록(필터 포함) 조회. */
export function useHoldingStock(filter?: HoldingStockFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => holdingStockRepo.list(filter),
  });
}

/** 입고 보류 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveHoldingStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: HoldingStock) => holdingStockRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
