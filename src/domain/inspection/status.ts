import type { Inspection } from './schema';

type InspectionStatus = Inspection['status'];

/**
 * 검사 상태머신 — 허용 전이만 가능. ([[데이터_모델_설계서.md]] §4 상태머신)
 * 대기 → 검사중 → 판정완료. 대기/검사중에서 보류 분기, 보류 → 검사중 재개.
 */
const ALLOWED: Record<InspectionStatus, InspectionStatus[]> = {
  대기: ['검사중', '보류'],
  검사중: ['판정완료', '보류'],
  보류: ['검사중'],
  판정완료: [],
};

/** 정방향 진행(주 액션) 다음 상태. 종료 상태면 null. */
const FORWARD: Record<InspectionStatus, InspectionStatus | null> = {
  대기: '검사중',
  검사중: '판정완료',
  보류: '검사중',
  판정완료: null,
};

export function canTransition(from: InspectionStatus, to: InspectionStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: InspectionStatus): InspectionStatus | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: InspectionStatus): string | null {
  return { 대기: '검사 착수', 검사중: '판정 등록', 보류: '검사 재개', 판정완료: null }[s];
}
