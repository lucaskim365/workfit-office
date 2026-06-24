import type { DailyCheck } from './schema';

type DcState = DailyCheck['state'];

/**
 * 일상점검 상태머신 — 허용 전이만 가능. ([[데이터_모델_설계서.md]] §4 상태머신)
 * 미점검 → 진행중 → 완료 (선형 진행). 채번 없음.
 */
const ALLOWED: Record<DcState, DcState[]> = {
  미점검: ['진행중'],
  진행중: ['완료'],
  완료: [],
};

const FORWARD: Record<DcState, DcState | null> = {
  미점검: '진행중',
  진행중: '완료',
  완료: null,
};

export function canTransition(from: DcState, to: DcState): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: DcState): DcState | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: DcState): string | null {
  return { 미점검: '점검 착수', 진행중: '점검 완료', 완료: null }[s];
}
