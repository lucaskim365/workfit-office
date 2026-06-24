import type { SpcAlarm } from './schema';

type SpcAlarmStatus = SpcAlarm['status'];

/**
 * SPC 품질알람 상태머신 — 허용 전이만 가능. ([[데이터_모델_설계서.md]] §4 상태머신)
 * 미확인 → 확인 → 조치중 → 해제 (선형 진행).
 */
const ALLOWED: Record<SpcAlarmStatus, SpcAlarmStatus[]> = {
  미확인: ['확인'],
  확인: ['조치중'],
  조치중: ['해제'],
  해제: [],
};

const FORWARD: Record<SpcAlarmStatus, SpcAlarmStatus | null> = {
  미확인: '확인',
  확인: '조치중',
  조치중: '해제',
  해제: null,
};

export function canTransition(from: SpcAlarmStatus, to: SpcAlarmStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: SpcAlarmStatus): SpcAlarmStatus | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: SpcAlarmStatus): string | null {
  return { 미확인: '알람 확인', 확인: '조치 착수', 조치중: '알람 해제', 해제: null }[s];
}
