import type { BmAction } from './schema';

type BmState = BmAction['state'];

/**
 * 사후보전(BM) 상태머신 — 허용 전이만 가능.
 * 접수 → 진단중 → 수리중 → 시운전 → 완료 (선형 진행).
 */
const ALLOWED: Record<BmState, BmState[]> = {
  접수: ['진단중'],
  진단중: ['수리중'],
  수리중: ['시운전'],
  시운전: ['완료'],
  완료: [],
};

const FORWARD: Record<BmState, BmState | null> = {
  접수: '진단중',
  진단중: '수리중',
  수리중: '시운전',
  시운전: '완료',
  완료: null,
};

export function canTransition(from: BmState, to: BmState): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: BmState): BmState | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: BmState): string | null {
  return { 접수: '진단 착수', 진단중: '수리 진행', 수리중: '시운전 진행', 시운전: '완료 처리', 완료: null }[s];
}
