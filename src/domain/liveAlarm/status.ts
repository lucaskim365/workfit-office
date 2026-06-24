import type { LiveAlarm } from './schema';

type AlarmState = LiveAlarm['state'];

/**
 * 설비 실시간 알람 상태머신 — 허용 전이만 가능.
 * 미조치 → 조치중 → 완료 (선형 진행). 채번 없음.
 */
const ALLOWED: Record<AlarmState, AlarmState[]> = {
  미조치: ['조치중'],
  조치중: ['완료'],
  완료: [],
};

const FORWARD: Record<AlarmState, AlarmState | null> = {
  미조치: '조치중',
  조치중: '완료',
  완료: null,
};

export function canTransition(from: AlarmState, to: AlarmState): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: AlarmState): AlarmState | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: AlarmState): string | null {
  return { 미조치: '조치 착수', 조치중: '조치 완료', 완료: null }[s];
}
