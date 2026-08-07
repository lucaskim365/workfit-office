import { SUCCESSION_SEED, type ApprovalSuccession } from '../seeds/succession.seed';

const STORAGE_KEY = 'workfit_approval_successions';

export const successionRepo = {
  /** 전체 승계 설정 목록 조회 (기본값으로 Seed 데이터 탑재) */
  getAll(): ApprovalSuccession[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as ApprovalSuccession[];
      }
    } catch (e) {
      console.warn('Failed to parse successions from localStorage:', e);
    }
    // 데이터가 아예 없을 경우 Seed 데이터를 기본값으로 설정 및 저장
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SUCCESSION_SEED));
    return SUCCESSION_SEED;
  },

  /** 특정 후임자(successorId)의 전임자 ID 목록 조회 */
  getPredecessorsOf(userId: string): string[] {
    const list = this.getAll();
    return list
      .filter((s) => s.successorId === userId)
      .map((s) => s.predecessorId);
  },

  /** 특정 전임자(predecessorId)의 후임자 ID 조회 */
  getSuccessorOf(userId: string): string | null {
    const list = this.getAll();
    const item = list.find((s) => s.predecessorId === userId);
    return item ? item.successorId : null;
  },

  /** 신규 인수인계(승계) 매핑 추가 */
  add(predecessorId: string, successorId: string): ApprovalSuccession {
    const list = this.getAll();
    
    // 이미 존재하는 전임자 매핑이 있다면 삭제하거나 덮어씀 (1대1 매핑 원칙)
    const filtered = list.filter((s) => s.predecessorId !== predecessorId);
    
    const newItem: ApprovalSuccession = {
      id: `succ_${Date.now()}`,
      predecessorId,
      successorId,
      effectiveDate: new Date().toISOString(),
    };
    
    const nextList = [...filtered, newItem];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    return newItem;
  },

  /** 승계 매핑 관계 삭제 */
  delete(id: string): void {
    const list = this.getAll();
    const nextList = list.filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
  }
};
