import type { MaintOutsourcing } from './schema';

type OsState = MaintOutsourcing['state'];

/**
 * 보전 외주 상태머신 — 허용 전이만 가능.
 * 접수 → 진행중 → 입고대기 → 완료 (선형 진행).
 */
const ALLOWED: Record<OsState, OsState[]> = {
  접수: ['진행중'],
  진행중: ['입고대기'],
  입고대기: ['완료'],
  완료: [],
};

const FORWARD: Record<OsState, OsState | null> = {
  접수: '진행중',
  진행중: '입고대기',
  입고대기: '완료',
  완료: null,
};

export function canTransition(from: OsState, to: OsState): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: OsState): OsState | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: OsState): string | null {
  return { 접수: '작업 착수', 진행중: '입고 대기', 입고대기: '입고 완료', 완료: null }[s];
}
