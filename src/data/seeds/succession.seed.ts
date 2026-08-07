export interface ApprovalSuccession {
  id: string;
  predecessorId: string; // 전임자 ID (예: U002 류지광)
  successorId: string;   // 후임자 ID (예: 모란)
  effectiveDate: string; // 승계 시작일 (ISO Date)
}

/**
 * 류지광 이사(U002)의 업무를 후임자(모란 - 임시 ID 'U_MORAN' 또는 실제 추가된 ID)에게 승계
 */
export const SUCCESSION_SEED: ApprovalSuccession[] = [
  {
    id: 'succ_001',
    predecessorId: 'U002', // 류지광 이사
    successorId: 'U_MORAN', // 모란 대리 (임시/테스트용)
    effectiveDate: '2026-08-01T00:00:00.000Z',
  }
];
