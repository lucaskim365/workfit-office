import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itemRepo, type ItemFilter } from '@/data/item/item.repo';
import type { Item } from '@/domain/item/schema';

/**
 * 품목 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'items';

/** 품목 목록(필터 포함) 조회. */
export function useItems(filter?: ItemFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => itemRepo.list(filter),
  });
}

/** 품목 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: Item) => itemRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 품목 삭제. */
export function useRemoveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => itemRepo.remove(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
