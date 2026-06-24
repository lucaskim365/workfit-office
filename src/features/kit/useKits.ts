import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { kitRepo, type KitFilter } from '@/data/kit/kit.repo';
import type { Kit } from '@/domain/kit/schema';

/**
 * 키팅 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'kits';

/** 키팅 지시 목록(필터 포함) 조회. */
export function useKits(filter?: KitFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => kitRepo.list(filter),
  });
}

/** 키팅 지시 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: Kit) => kitRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
