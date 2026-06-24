import type { Nonconformance } from './schema';

type NcrStatus = Nonconformance['status'];

/**
 * 부적합(NCR) 상태머신 — 허용 전이만 가능. ([[데이터_모델_설계서.md]] §4 상태머신)
 * 발행 → 조사중 → 조치중 → 종결 (선형 진행).
 */
const ALLOWED: Record<NcrStatus, NcrStatus[]> = {
  발행: ['조사중'],
  조사중: ['조치중'],
  조치중: ['종결'],
  종결: [],
};

const FORWARD: Record<NcrStatus, NcrStatus | null> = {
  발행: '조사중',
  조사중: '조치중',
  조치중: '종결',
  종결: null,
};

export function canTransition(from: NcrStatus, to: NcrStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: NcrStatus): NcrStatus | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: NcrStatus): string | null {
  return { 발행: '원인 조사 착수', 조사중: '조치 진행', 조치중: '종결 처리', 종결: null }[s];
}
