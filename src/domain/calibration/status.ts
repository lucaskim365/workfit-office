import type { Calibration } from './schema';

type CalStatus = Calibration['status'];

/**
 * 검교정(Calibration) 상태머신 — 허용 전이만 가능. ([[데이터_모델_설계서.md]] §4 상태머신)
 * 예정 → 진행중 → 완료 (정상 진행), 예정 → 지연(기한 초과), 지연 → 진행중(재개).
 */
const ALLOWED: Record<CalStatus, CalStatus[]> = {
  예정: ['진행중', '지연'],
  진행중: ['완료'],
  지연: ['진행중'],
  완료: [],
};

const FORWARD: Record<CalStatus, CalStatus | null> = {
  예정: '진행중',
  진행중: '완료',
  지연: '진행중',
  완료: null,
};

export function canTransition(from: CalStatus, to: CalStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: CalStatus): CalStatus | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: CalStatus): string | null {
  return { 예정: '검교정 착수', 진행중: '완료 처리', 지연: '재개', 완료: null }[s];
}
