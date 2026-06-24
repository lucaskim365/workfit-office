import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { spcChartRepo, type SpcChartFilter } from '@/data/spcChart/spcChart.repo';
import type { SpcChart } from '@/domain/spcChart/schema';

/**
 * SPC 관리도 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다. ([[비즈니스_로직_개발_전략.md]] 계층 구조)
 */
const KEY = 'spcCharts';

/** SPC 관리도 목록(필터 포함) 조회. */
export function useSpcCharts(filter?: SpcChartFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => spcChartRepo.list(filter),
  });
}

/** SPC 관리도 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveSpcChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SpcChart) => spcChartRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
