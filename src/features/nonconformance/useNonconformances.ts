import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nonconformanceRepo, type NcrFilter } from '@/data/nonconformance/nonconformance.repo';
import type { Nonconformance } from '@/domain/nonconformance/schema';

/**
 * 부적합(NCR) 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'nonconformances';

/** NCR 목록(출처·상태·검색 필터) 조회. */
export function useNonconformances(filter?: NcrFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => nonconformanceRepo.list(filter),
  });
}

/** 상태 전이(조사 착수·조치 진행·종결 처리). */
export function useTransitionNcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, to }: { no: string; to: Nonconformance['status'] }) =>
      nonconformanceRepo.transition(no, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
