import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { salesCollectionRepo, type SalesCollectionFilter } from '@/data/salesCollection/salesCollection.repo';
import type { SalesCollection } from '@/domain/salesCollection/schema';

/**
 * 수금 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다.
 */
const KEY = 'salesCollections';

/** 수금 목록(필터 포함) 조회. */
export function useSalesCollections(filter?: SalesCollectionFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => salesCollectionRepo.list(filter),
  });
}

/** 수금 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveSalesCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SalesCollection) => salesCollectionRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
