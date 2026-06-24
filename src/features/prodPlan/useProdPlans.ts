import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { prodPlanRepo, type ProdPlanFilter } from '@/data/prodPlan/prodPlan.repo';
import type { ProdPlan } from '@/domain/prodPlan/schema';

/**
 * 생산계획 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'prodPlans';

/** 생산계획 목록(필터 포함) 조회. */
export function useProdPlans(filter?: ProdPlanFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => prodPlanRepo.list(filter),
  });
}

/** 생산계획 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveProdPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: ProdPlan) => prodPlanRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
