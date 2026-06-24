import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { wipStatusRepo, type WipStatusFilter } from '@/data/wipStatus/wipStatus.repo';
import type { WipStatus } from '@/domain/wipStatus/schema';

/**
 * 재공 현황 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'wipStatus';

/** 재공 현황 목록(필터 포함) 조회. */
export function useWipStatus(filter?: WipStatusFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => wipStatusRepo.list(filter),
  });
}

/** 재공 현황 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveWipStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: WipStatus) => wipStatusRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
