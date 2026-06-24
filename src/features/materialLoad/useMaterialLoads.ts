import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { materialLoadRepo, type MaterialLoadFilter } from '@/data/materialLoad/materialLoad.repo';
import type { MaterialLoad } from '@/domain/materialLoad/schema';

/**
 * 자재 투입 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'materialLoads';

/** 자재 투입 목록(필터 포함) 조회. */
export function useMaterialLoads(filter?: MaterialLoadFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => materialLoadRepo.list(filter),
  });
}

/** 자재 투입 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveMaterialLoad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: MaterialLoad) => materialLoadRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
