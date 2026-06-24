import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inspectionItemRepo, type InspectionItemFilter } from '@/data/inspectionItem/inspectionItem.repo';
import type { InspectionItem } from '@/domain/inspectionItem/schema';

/**
 * 검사항목 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'inspectionItems';

/** 검사항목 목록(필터 포함) 조회. */
export function useInspectionItems(filter?: InspectionItemFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => inspectionItemRepo.list(filter),
  });
}

/** 검사항목 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveInspectionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: InspectionItem) => inspectionItemRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 검사항목 삭제. */
export function useRemoveInspectionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => inspectionItemRepo.remove(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
