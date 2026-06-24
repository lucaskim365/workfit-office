import { workOrderRepo } from '@/data/workOrder/workOrder.repo';
import { stockRepo } from '@/data/stock/stock.repo';

/**
 * 생산 서비스 — 여러 repo를 가로지르는 트랜잭션성 업무를 캡슐화.
 * ★ cross-entity 정합성: "작업지시 완료 → 상태 전이 + 생산입고 원장 기록"을
 *   한 곳(Service)에 모은다. 운영 전환 시 이 함수 내부만 Firestore 트랜잭션 /
 *   Cloud Function 으로 원자화하면 화면·repo 변경 없이 정합성이 보장된다.
 * ([[데이터_모델_설계서.md]] §0 트랜잭션 정합성 / [[DB_이관_대비_설계원칙.md]] §3)
 */
export const productionService = {
  /**
   * 작업지시 완료 처리.
   * 1) 상태머신: 진행/지연 → 완료 (workOrderRepo.transition 이 전이 검증)
   * 2) 재고 원장: 완제품 생산입고(+qty) 기록 (stockRepo.addMovement)
   */
  async completeWorkOrder(no: string, at: string, warehouse = 'FG-Zone'): Promise<void> {
    const wo = (await workOrderRepo.list()).find((w) => w.no === no);
    if (!wo) throw new Error(`작업지시 없음: ${no}`);

    // 1) 상태 전이(불가 전이면 여기서 예외 → 후속 원장 기록도 일어나지 않음)
    await workOrderRepo.transition(no, '완료', at);

    // 2) 생산입고 원장 기록 (완제품 입고)
    await stockRepo.addMovement({
      type: '생산입고',
      item: wo.code,
      itemName: wo.itemName,
      warehouse,
      lot: '',
      qtyDelta: wo.qty,
      reason: `작업지시 완료 생산입고 (${no})`,
      refDoc: no,
      at,
      by: '시스템',
    });
  },
};
