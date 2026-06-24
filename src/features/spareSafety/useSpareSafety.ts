import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { spareSafetyRepo, type SpareSafetyFilter } from '@/data/spareSafety/spareSafety.repo';
import type { SpareSafety } from '@/domain/spareSafety/schema';

/**
 * 예비품 안전재고 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'spareSafety';

/** 안전재고 미달 목록(필터 포함) 조회. */
export function useSpareSafety(filter?: SpareSafetyFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => spareSafetyRepo.list(filter),
  });
}

/** 예비품 안전재고 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveSpareSafety() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SpareSafety) => spareSafetyRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
