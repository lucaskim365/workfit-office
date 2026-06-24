import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shipmentRepo, type ShipmentFilter } from '@/data/shipment/shipment.repo';
import { shippingService } from '@/services/shipping.service';
import type { ShipmentStatus } from '@/domain/shipment/schema';

/** 출하 데이터 훅 — 조회 + 상태전이 + 출고완료(cross-entity). ([[data-layer-pattern]]) */
const KEY = 'shipments';

export function useShipments(filter?: ShipmentFilter) {
  return useQuery({ queryKey: [KEY, filter ?? null], queryFn: () => shipmentRepo.list(filter) });
}

/** 단순 전이(출고대기→피킹중 등). */
export function useAdvanceShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, to }: { no: string; to: ShipmentStatus }) => shipmentRepo.transition(no, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** 출고 완료 — 출하·수주·재고 캐시 모두 무효화. */
export function useCompleteShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, at }: { no: string; at: string }) => shippingService.completeShipment(no, at),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ['salesOrders'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}
