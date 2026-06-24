import { inspectionRepo } from '@/data/inspection/inspection.repo';
import { stockRepo } from '@/data/stock/stock.repo';
import { nonconformanceRepo } from '@/data/nonconformance/nonconformance.repo';
import type { Inspection, InspectionLine } from '@/domain/inspection/schema';

/**
 * 품질 서비스 — 검사 판정의 cross-entity 정합성(품질 → 재고/부적합).
 * ★ "수입검사 판정 → ① 판정 확정(상태머신) + ② 합격 시 재고 입고(+qty)
 *    / 불합격·반품 시 부적합(NCR) 자동 발행".
 *   여러 repo(inspections·stockMovements·nonconformances)를 한 곳에 모은다.
 *   운영 전환 시 이 함수 내부만 Firestore 트랜잭션 / Cloud Function 으로
 *   원자화하면 화면·repo 변경 없이 정합성이 보장된다.
 * ([[데이터_모델_설계서.md]] §0 트랜잭션 정합성 / holdingStock IQC 흐름 / [[data-layer-pattern]])
 */
const ACCEPT: Inspection['judgement'][] = ['합격', '조건부합격', '특채'];

export const qualityService = {
  /**
   * 수입검사(IQC) 판정 처리.
   * 1) 측정 실적 + 판정 저장, 상태 검사중 → 판정완료 (inspectionRepo.judge 가 전이 검증)
   * 2) 합격/조건부/특채 → 해당 LOT 재고 입고(+qty) 원장 기록
   *    불합격/반품 → 부적합(NCR) 자동 발행 (재고 미가산, 격리)
   */
  async judgeIncomingInspection(args: {
    recv: string;
    judgement: NonNullable<Inspection['judgement']>;
    items: InspectionLine[];
    at: string;
    warehouse?: string;
  }): Promise<void> {
    const { recv, judgement, items, at, warehouse = '자재창고' } = args;

    // 1) 판정 확정(불가 상태면 여기서 예외 → 후속 재고/NCR 처리도 일어나지 않음)
    await inspectionRepo.judge(recv, judgement, items);

    const insp = await inspectionRepo.get(recv);
    if (!insp) throw new Error(`검사 건 없음: ${recv}`);

    if (ACCEPT.includes(judgement)) {
      // 2-a) 합격 계열 → 재고 입고(+qty). 등급/특채는 reason에 명시.
      await stockRepo.addMovement({
        type: '입고',
        item: insp.code,
        itemName: insp.name,
        warehouse,
        lot: insp.lot,
        qtyDelta: insp.qty,
        reason: `IQC ${judgement} 입고 (${recv})`,
        refDoc: recv,
        at,
        by: '시스템',
      });
    } else {
      // 2-b) 불합격/반품 → 부적합(NCR) 자동 발행. 재고 미가산(격리).
      await nonconformanceRepo.create(
        {
          src: '수입검사',
          loc: `입고검사 · ${recv}`,
          code: insp.code,
          name: insp.name,
          lot: insp.lot,
          defect: '수입검사 불합격',
          sev: '주요',
          qty: insp.qty,
          iso: insp.qty,
          fault: '협력사 귀책',
          disp: judgement === '반품' ? '반품' : '폐기',
          pic: insp.pic,
          desc: `수입검사(${recv}) 판정 「${judgement}」 — 자동 NCR 발행. 입고 LOT ${insp.lot} 격리.`,
        },
        new Date(at),
      );
    }
  },
};
