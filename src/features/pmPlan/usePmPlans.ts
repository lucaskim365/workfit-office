import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pmPlanRepo, type PmPlanFilter } from '@/data/pmPlan/pmPlan.repo';
import type { PmPlan } from '@/domain/pmPlan/schema';

/**
 * 예방보전(PM) 계획 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'pmPlans';

/** PM 계획 목록(필터 포함) 조회. */
export function usePmPlans(filter?: PmPlanFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => pmPlanRepo.list(filter),
  });
}

/** PM 계획 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSavePmPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: PmPlan) => pmPlanRepo.save(plan),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
