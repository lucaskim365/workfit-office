import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { matScrapRepo, type MatScrapFilter } from '@/data/matScrap/matScrap.repo';
import type { MatScrap } from '@/domain/matScrap/schema';

/**
 * 자재 폐기 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'matScraps';

/** 자재 폐기 목록(필터 포함) 조회. */
export function useMatScraps(filter?: MatScrapFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => matScrapRepo.list(filter),
  });
}

/** 자재 폐기 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveMatScrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: MatScrap) => matScrapRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
