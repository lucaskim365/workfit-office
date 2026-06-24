import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { urgentOrderRepo, type UrgentOrderFilter } from '@/data/urgentOrder/urgentOrder.repo';
import type { UrgentOrder } from '@/domain/urgentOrder/schema';

/**
 * 긴급오더 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'urgentOrders';

/** 긴급오더 이력(필터 포함) 조회. */
export function useUrgentOrders(filter?: UrgentOrderFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => urgentOrderRepo.list(filter),
  });
}

/** 긴급오더 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveUrgentOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: UrgentOrder) => urgentOrderRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
