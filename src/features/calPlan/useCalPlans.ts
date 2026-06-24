import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calPlanRepo, type CalPlanFilter } from '@/data/calPlan/calPlan.repo';
import type { CalPlan } from '@/domain/calPlan/schema';

/**
 * 검교정 주기·계획 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'calPlans';

/** 검교정 계획 목록(필터 포함) 조회. */
export function useCalPlans(filter?: CalPlanFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => calPlanRepo.list(filter),
  });
}

/** 검교정 계획 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveCalPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: CalPlan) => calPlanRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
