import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reworkOrderRepo, type ReworkFilter } from '@/data/reworkOrder/reworkOrder.repo';
import type { ReworkOrder } from '@/domain/reworkOrder/schema';

/**
 * 재작업·폐기 지시 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'reworkOrders';

/** 재작업·폐기 지시 목록(구분·상태·검색 필터) 조회. */
export function useReworkOrders(filter?: ReworkFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => reworkOrderRepo.list(filter),
  });
}

/** 상태 전이(작업 시작·검증 요청·완료·폐기 승인). */
export function useTransitionRework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, to }: { no: string; to: ReworkOrder['status'] }) =>
      reworkOrderRepo.transition(no, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
