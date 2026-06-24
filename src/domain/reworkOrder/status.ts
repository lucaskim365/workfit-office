import type { ReworkOrder } from './schema';

type RwStatus = ReworkOrder['status'];

/**
 * 재작업·폐기 지시 상태머신 — 허용 전이만 가능. ([[데이터_모델_설계서.md]] §4 상태머신)
 * 재작업: 지시 → 작업중 → 검증대기 → 완료
 * 폐기:   승인대기 → 완료
 * (두 경로를 모두 한 머신에서 허용 — type에 따라 시작 상태가 다름)
 */
const ALLOWED: Record<RwStatus, RwStatus[]> = {
  지시: ['작업중'],
  작업중: ['검증대기'],
  검증대기: ['완료'],
  승인대기: ['완료'],
  완료: [],
};

const FORWARD: Record<RwStatus, RwStatus | null> = {
  지시: '작업중',
  작업중: '검증대기',
  검증대기: '완료',
  승인대기: '완료',
  완료: null,
};

export function canTransition(from: RwStatus, to: RwStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: RwStatus): RwStatus | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: RwStatus): string | null {
  return { 지시: '작업 시작', 작업중: '검증 요청', 검증대기: '완료 처리', 승인대기: '폐기 승인', 완료: null }[s];
}
