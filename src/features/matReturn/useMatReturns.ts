import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { matReturnRepo, type MatReturnFilter } from '@/data/matReturn/matReturn.repo';
import type { MatReturn } from '@/domain/matReturn/schema';

/**
 * 자재 반품 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'matReturns';

/** 반품/환수 목록(필터 포함) 조회. */
export function useMatReturns(filter?: MatReturnFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => matReturnRepo.list(filter),
  });
}

/** 반품/환수 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveMatReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: MatReturn) => matReturnRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
