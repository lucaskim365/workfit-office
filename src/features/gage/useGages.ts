import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gageRepo, type GageFilter } from '@/data/gage/gage.repo';
import type { Gage } from '@/domain/gage/schema';

/**
 * 계측기·검사장비 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'gages';

/** 계측기 목록(필터 포함) 조회. */
export function useGages(filter?: GageFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => gageRepo.list(filter),
  });
}

/** 계측기 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveGage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: Gage) => gageRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
