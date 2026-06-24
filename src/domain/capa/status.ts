import type { Capa } from './schema';

type CapaStatus = Capa['status'];

/**
 * 시정·예방조치(CAPA) 상태머신 — 허용 전이만 가능. ([[데이터_모델_설계서.md]] §4 상태머신)
 * 진행 → 검증 → 종결 (선형 진행). 진행 ↔ 지연 분기, 지연 → 검증 재합류.
 */
const ALLOWED: Record<CapaStatus, CapaStatus[]> = {
  진행: ['검증', '지연'],
  지연: ['진행', '검증'],
  검증: ['종결'],
  종결: [],
};

const FORWARD: Record<CapaStatus, CapaStatus | null> = {
  진행: '검증',
  지연: '진행',
  검증: '종결',
  종결: null,
};

export function canTransition(from: CapaStatus, to: CapaStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: CapaStatus): CapaStatus | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: CapaStatus): string | null {
  return { 진행: '검증 단계로', 지연: '재개', 검증: '종결 처리', 종결: null }[s];
}
