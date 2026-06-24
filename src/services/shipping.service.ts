import { shipmentRepo } from '@/data/shipment/shipment.repo';
import { salesOrderRepo } from '@/data/salesOrder/salesOrder.repo';
import { stockRepo } from '@/data/stock/stock.repo';

/**
 * 출하 서비스 — 출하 완료의 cross-entity 정합성을 한 곳에 캡슐화.
 * "출고 완료 → 출하 상태전이 + 수주 납품량 가산(납품상태 자동 도출) + 재고 출고 차감".
 * 운영 전환 시 이 함수만 Firestore 트랜잭션/Cloud Function으로 원자화.
 * ([[데이터_모델_설계서.md]] §0 / [[data-layer-pattern]] cross-entity 서비스)
 */
export const shippingService = {
  async completeShipment(no: string, at: string): Promise<void> {
    const s = await shipmentRepo.get(no);
    if (!s) throw new Error(`출하 없음: ${no}`);

    // 1) 출하 상태머신: 피킹중 → 출고완료 (불가 전이면 예외 → 후속 미수행)
    await shipmentRepo.transition(no, '출고완료');

    // 2) 수주 납품량 가산 → 납품상태(미납/부분납품/완납) 자동 도출
    await salesOrderRepo.recordDelivery(s.salesOrder, { [s.item]: s.qty });

    // 3) 재고 원장: 출고 차감(−qty)
    await stockRepo.addMovement({
      type: '불출',
      item: s.item,
      itemName: s.itemName,
      warehouse: s.warehouse,
      lot: '',
      qtyDelta: -s.qty,
      reason: `출하 출고 (${no} → ${s.salesOrder})`,
      refDoc: no,
      at,
      by: '시스템',
    });
  },
};
