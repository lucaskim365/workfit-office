import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { downtimeRepo, type DowntimeFilter } from '@/data/downtime/downtime.repo';
import type { Downtime } from '@/domain/downtime/schema';

/**
 * 설비 비가동 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'downtimes';

/** 비가동 이력(필터 포함) 조회. */
export function useDowntimes(filter?: DowntimeFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => downtimeRepo.list(filter),
  });
}

/** 비가동 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveDowntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: Downtime) => downtimeRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
