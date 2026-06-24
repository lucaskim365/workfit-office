import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sparePartRepo, type SparePartFilter } from '@/data/sparePart/sparePart.repo';
import type { SparePart } from '@/domain/sparePart/schema';

/**
 * 예비품 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'spareParts';

/** 예비품 목록(필터 포함) 조회. */
export function useSpareParts(filter?: SparePartFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => sparePartRepo.list(filter),
  });
}

/** 예비품 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveSparePart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SparePart) => sparePartRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
