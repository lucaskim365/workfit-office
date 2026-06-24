import type { SubconOrder } from './schema';

type SubconStatus = SubconOrder['status'];

/**
 * 외주 발주 상태머신 — 허용 전이만 가능. ([[데이터_모델_설계서.md]] §4 상태머신)
 * 지시 → 생산중 → 입고대기 → 완료 (선형 진행).
 */
const ALLOWED: Record<SubconStatus, SubconStatus[]> = {
  지시: ['생산중'],
  생산중: ['입고대기'],
  입고대기: ['완료'],
  완료: [],
};

const FORWARD: Record<SubconStatus, SubconStatus | null> = {
  지시: '생산중',
  생산중: '입고대기',
  입고대기: '완료',
  완료: null,
};

export function canTransition(from: SubconStatus, to: SubconStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: SubconStatus): SubconStatus | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: SubconStatus): string | null {
  return { 지시: '생산 착수', 생산중: '입고 대기', 입고대기: '입고 완료', 완료: null }[s];
}
