import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adjustmentRepo, type AdjustmentFilter } from '@/data/adjustment/adjustment.repo';
import type { Adjustment } from '@/domain/adjustment/schema';

/**
 * 재고 조정 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'adjustments';

/** 재고 조정 목록(필터 포함) 조회. */
export function useAdjustments(filter?: AdjustmentFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => adjustmentRepo.list(filter),
  });
}

/** 재고 조정 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: Adjustment) => adjustmentRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
