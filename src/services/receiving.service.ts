import { receiptRepo } from '@/data/receipt/receipt.repo';
import { stockRepo } from '@/data/stock/stock.repo';

/**
 * 입고 서비스 — 입고 처리의 cross-entity 정합성.
 * "입고 처리 → 입고수량 가산 + 재고 입고(+qty) 원장 기록".
 * 운영 시 이 함수만 Firestore 트랜잭션/Cloud Function으로 원자화.
 * ([[데이터_모델_설계서.md]] §0 / [[data-layer-pattern]])
 */
export const receivingService = {
  /** 잔여 PO수량 전량 입고 처리(부분입고 → 입고완료). */
  async receiveRemaining(po: string, at: string): Promise<void> {
    const r = await receiptRepo.get(po);
    if (!r) throw new Error(`입고 PO 없음: ${po}`);
    const remaining = r.poQty - r.recvQty;
    if (remaining <= 0) return;

    // 1) 입고수량 가산(입고상태 자동 도출)
    const applied = await receiptRepo.addReceived(po, remaining);

    // 2) 재고 원장: 입고(+qty)
    if (applied > 0) {
      await stockRepo.addMovement({
        type: '입고',
        item: r.item,
        itemName: r.itemName,
        warehouse: r.warehouse,
        lot: '',
        qtyDelta: applied,
        reason: `구매 입고 (${po})`,
        refDoc: po,
        at,
        by: '시스템',
      });
    }
  },
};
