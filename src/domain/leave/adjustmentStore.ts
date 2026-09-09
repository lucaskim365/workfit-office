/**
 * 연차 수동 가감(조정) 트랜잭션 저장소
 *
 * [엄격 규칙: rule-readonly.md]
 * 기존 실제 DB(appwrite, garage s3)의 결재 문서 및 마스터 데이터를 일체 수정하지 않고,
 * 관리자가 부여한 포상휴가(+), 공제(-), 특별조정 내역을 독립적으로 안전하게 격리 보관합니다.
 */

export type AdjustmentType = 'REWARD' | 'PENALTY' | 'SPECIAL' | 'CARRYOVER' | 'MANUAL';

export interface LeaveAdjustmentTransaction {
  id: string;
  empId?: number | null;
  empName: string;
  empNo?: string | null;
  type: AdjustmentType;
  deltaDays: number; // +1.0, -0.5 등
  reason: string;
  grantedAt: string; // YYYY-MM-DD
  grantedBy: string; // 등록한 관리자 성명
  createdAt: string; // ISO string
}

const STORAGE_KEY = 'workfit_leave_adjustments_v1';

// 브라우저 로컬 스토리지 안전 읽기
export function getStoredAdjustments(): LeaveAdjustmentTransaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LeaveAdjustmentTransaction[];
  } catch (err) {
    console.error('Failed to read leave adjustments:', err);
    return [];
  }
}

// 브라우저 로컬 스토리지 안전 쓰기
export function saveAdjustment(
  adjustment: Omit<LeaveAdjustmentTransaction, 'id' | 'createdAt'>,
): LeaveAdjustmentTransaction {
  const current = getStoredAdjustments();
  const newTx: LeaveAdjustmentTransaction = {
    ...adjustment,
    id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  const updated = [newTx, ...current];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save leave adjustment:', err);
    }
  }

  // 커스텀 이벤트 발송으로 실시간 리액티브 동기화 지원
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workfit-leave-adjustment-updated'));
  }

  return newTx;
}

// 특정 사원의 가감 트랜잭션 목록 및 총합 계산
export function getAdjustmentsForEmployee(
  empName: string,
  adjustments: LeaveAdjustmentTransaction[] = getStoredAdjustments(),
): { list: LeaveAdjustmentTransaction[]; totalDelta: number } {
  const norm = (s?: string | null) => (s || '').replace(/\s+/g, '');
  const targetNorm = norm(empName);

  const matched = adjustments.filter((tx) => norm(tx.empName) === targetNorm);
  const totalDelta = matched.reduce((sum, tx) => sum + tx.deltaDays, 0);

  return { list: matched, totalDelta };
}
