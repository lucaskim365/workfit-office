import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subconOrderRepo, type SubconOrderFilter } from '@/data/subconOrder/subconOrder.repo';
import type { SubconOrder } from '@/domain/subconOrder/schema';

/**
 * 외주 발주 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 상태 전이는 mutation으로, 성공 시 목록 캐시 무효화.
 */
const KEY = 'subconOrders';

/** 외주 발주 목록(상태·검색 필터) 조회. */
export function useSubconOrders(filter?: SubconOrderFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => subconOrderRepo.list(filter),
  });
}

/** 상태 전이(생산 착수·입고 대기·입고 완료). */
export function useTransitionSubconOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, to }: { no: string; to: SubconOrder['status'] }) =>
      subconOrderRepo.transition(no, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
