import { issueRepo } from '@/data/issue/issue.repo';
import { stockRepo } from '@/data/stock/stock.repo';

/**
 * 불출 서비스 — 불출 완료의 cross-entity 정합성.
 * "불출 완료 → 상태 전환 + 자재별 재고 차감(−qty) 원장 기록".
 * 운영 시 이 함수만 Firestore 트랜잭션/Cloud Function으로 원자화.
 * ([[데이터_모델_설계서.md]] §0 / [[data-layer-pattern]])
 */
export const issuingService = {
  async completeIssue(no: string, at: string): Promise<void> {
    const x = await issueRepo.get(no);
    if (!x) throw new Error(`불출 없음: ${no}`);
    if (x.status === '불출완료') return;

    // 1) 상태: 준비중 → 불출완료
    await issueRepo.setStatus(no, '불출완료');

    // 2) 자재 라인별 재고 차감(−qty)
    for (const m of x.materials) {
      await stockRepo.addMovement({
        type: '불출',
        item: m.code,
        itemName: m.name,
        warehouse: x.warehouse,
        lot: '',
        qtyDelta: -m.qty,
        reason: `생산 불출 (${no} → ${x.wo})`,
        refDoc: no,
        at,
        by: '시스템',
      });
    }
  },
};
