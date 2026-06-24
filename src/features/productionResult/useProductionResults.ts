import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productionResultRepo, type ProductionResultFilter } from '@/data/productionResult/productionResult.repo';
import type { ProductionResult } from '@/domain/productionResult/schema';

/**
 * 생산실적 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'productionResults';

/** 생산실적 목록(필터 포함) 조회. */
export function useProductionResults(filter?: ProductionResultFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => productionResultRepo.list(filter),
  });
}

/** 생산실적 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveProductionResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: ProductionResult) => productionResultRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
