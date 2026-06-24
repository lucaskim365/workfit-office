import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deliveryOrderRepo, type DeliveryOrderFilter } from '@/data/deliveryOrder/deliveryOrder.repo';
import type { DeliveryOrder } from '@/domain/deliveryOrder/schema';

/**
 * 자재 출하지시 데이터 훅 — 화면(UI)이 repository 대신 호출하는 React 바인딩.
 * 화면은 firebase·repo를 직접 모른다.
 */
const KEY = 'deliveryOrders';

/** 출하지시 목록(필터 포함) 조회. */
export function useDeliveryOrders(filter?: DeliveryOrderFilter) {
  return useQuery({
    queryKey: [KEY, filter ?? null],
    queryFn: () => deliveryOrderRepo.list(filter),
  });
}

/** 출하지시 등록/수정. 성공 시 목록 캐시 무효화. */
export function useSaveDeliveryOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: DeliveryOrder) => deliveryOrderRepo.save(item),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
