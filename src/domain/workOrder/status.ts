import type { WoStatus } from './schema';

/**
 * 작업지시 상태머신 — 허용 전이만 가능. ([[데이터_모델_설계서.md]] §4 상태머신)
 * 대기 → 발행 → 진행 → 완료 (진행에서 대기/지연 분기, 지연 → 진행/완료).
 */
const ALLOWED: Record<WoStatus, WoStatus[]> = {
  대기: ['발행'],
  발행: ['진행', '대기'],
  진행: ['완료', '대기', '지연'],
  지연: ['진행', '완료'],
  완료: [],
};

/** 정방향 진행(주 액션) 다음 상태. 종료 상태면 null. */
const FORWARD: Record<WoStatus, WoStatus | null> = {
  대기: '발행',
  발행: '진행',
  진행: '완료',
  지연: '진행',
  완료: null,
};

export function canTransition(from: WoStatus, to: WoStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: WoStatus): WoStatus | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: WoStatus): string | null {
  return { 대기: '지시 발행', 발행: '작업 시작', 진행: '완료 처리', 지연: '작업 재개', 완료: null }[s];
}
