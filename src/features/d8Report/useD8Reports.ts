import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { d8ReportRepo, type D8Filter } from '@/data/d8Report/d8Report.repo';
import type { D8Report } from '@/domain/d8Report/schema';

/**
 * 8D 보고서 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'd8Reports';

/** 8D 보고서 목록(상태·검색 필터) 조회. */
export function useD8Reports(filter?: D8Filter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => d8ReportRepo.list(filter),
  });
}

/** 상태 전이(검토 요청·발행·고객 승인). */
export function useTransitionD8() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, to }: { no: string; to: D8Report['status'] }) =>
      d8ReportRepo.transition(no, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
