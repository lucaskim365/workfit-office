import type { Coa } from './schema';

type CoaStatus = Coa['status'];

/**
 * COA 상태머신 — 허용 전이만 가능. ([[데이터_모델_설계서.md]] §4 상태머신)
 * 발행대기 → 발행완료 → 전송완료 (선형).
 */
const ALLOWED: Record<CoaStatus, CoaStatus[]> = {
  발행대기: ['발행완료'],
  발행완료: ['전송완료'],
  전송완료: [],
};

const FORWARD: Record<CoaStatus, CoaStatus | null> = {
  발행대기: '발행완료',
  발행완료: '전송완료',
  전송완료: null,
};

export function canTransition(from: CoaStatus, to: CoaStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: CoaStatus): CoaStatus | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: CoaStatus): string | null {
  return { 발행대기: 'COA 발행 확정', 발행완료: '이메일 전송', 전송완료: null }[s];
}
