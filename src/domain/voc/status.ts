import type { Voc } from './schema';

type VocStatus = Voc['status'];

/**
 * 고객 클레임(VOC) 상태머신 — 허용 전이만 가능. ([[데이터_모델_설계서.md]] §4 상태머신)
 * 접수 → 조사중 → 회신 → 종결 (선형 진행).
 */
const ALLOWED: Record<VocStatus, VocStatus[]> = {
  접수: ['조사중'],
  조사중: ['회신'],
  회신: ['종결'],
  종결: [],
};

const FORWARD: Record<VocStatus, VocStatus | null> = {
  접수: '조사중',
  조사중: '회신',
  회신: '종결',
  종결: null,
};

export function canTransition(from: VocStatus, to: VocStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: VocStatus): VocStatus | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: VocStatus): string | null {
  return { 접수: '원인 조사 착수', 조사중: '고객 회신', 회신: '종결 처리', 종결: null }[s];
}
