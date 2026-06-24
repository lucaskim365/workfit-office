import type { D8Report } from './schema';

type D8Status = D8Report['status'];

/**
 * 8D 보고서 상태머신 — 허용 전이만 가능. ([[데이터_모델_설계서.md]] §4 상태머신)
 * 작성중 → 검토 → 발행 → 고객승인 (선형 진행).
 */
const ALLOWED: Record<D8Status, D8Status[]> = {
  작성중: ['검토'],
  검토: ['발행'],
  발행: ['고객승인'],
  고객승인: [],
};

const FORWARD: Record<D8Status, D8Status | null> = {
  작성중: '검토',
  검토: '발행',
  발행: '고객승인',
  고객승인: null,
};

export function canTransition(from: D8Status, to: D8Status): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: D8Status): D8Status | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: D8Status): string | null {
  return { 작성중: '검토 요청', 검토: '발행', 발행: '고객 승인', 고객승인: null }[s];
}
