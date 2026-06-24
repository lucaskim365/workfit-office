import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { salesRevenueRepo, type SalesRevenueFilter } from '@/data/salesRevenue/salesRevenue.repo';
import type { SalesRevenue } from '@/domain/salesRevenue/schema';

/**
 * 매출 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'salesRevenues';

/** 매출 목록(필터 포함) 조회. */
export function useSalesRevenues(filter?: SalesRevenueFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => salesRevenueRepo.list(filter),
  });
}

/** 매출 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveSalesRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SalesRevenue) => salesRevenueRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
