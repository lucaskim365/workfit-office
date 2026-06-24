import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lineMonitorRepo, type LineMonitorFilter } from '@/data/lineMonitor/lineMonitor.repo';
import type { LineMonitor } from '@/domain/lineMonitor/schema';

/**
 * 생산 라인 모니터 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'lineMonitors';

/** 라인 모니터 목록(필터 포함) 조회. */
export function useLineMonitors(filter?: LineMonitorFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => lineMonitorRepo.list(filter),
  });
}

/** 라인 모니터 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveLineMonitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: LineMonitor) => lineMonitorRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
