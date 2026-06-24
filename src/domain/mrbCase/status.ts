import type { MrbCase } from './schema';

type MrbStatus = MrbCase['status'];

/**
 * MRB 부적합 심의 상태머신 — 허용 전이만 가능. ([[데이터_모델_설계서.md]] §4 상태머신)
 * 심의대기 → 심의중 → 의결완료, 심의중 ↔ 보류, 보류 → 심의중 (보류 분기 포함).
 */
const ALLOWED: Record<MrbStatus, MrbStatus[]> = {
  심의대기: ['심의중'],
  심의중: ['의결완료', '보류'],
  보류: ['심의중'],
  의결완료: [],
};

/** 주 액션이 향하는 다음 상태(전진 방향). */
const FORWARD: Record<MrbStatus, MrbStatus | null> = {
  심의대기: '심의중',
  심의중: '의결완료',
  보류: '심의중',
  의결완료: null,
};

export function canTransition(from: MrbStatus, to: MrbStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: MrbStatus): MrbStatus | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: MrbStatus): string | null {
  return { 심의대기: '심의 시작', 심의중: '의결 확정', 보류: '심의 재개', 의결완료: null }[s];
}
