import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pickingListRepo, type PickingListFilter } from '@/data/pickingList/pickingList.repo';
import type { PickingList } from '@/domain/pickingList/schema';

/**
 * 피킹 리스트 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'pickingList';

/** 피킹 리스트 목록(필터 포함) 조회. */
export function usePickingList(filter?: PickingListFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => pickingListRepo.list(filter),
  });
}

/** 피킹 항목 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSavePickingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: PickingList) => pickingListRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
