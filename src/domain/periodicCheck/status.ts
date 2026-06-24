import type { PeriodicCheck } from './schema';

type PcStatus = PeriodicCheck['status'];

/**
 * 정기 점검(Periodic Check) 상태머신 — 허용 전이만 가능.
 * 진행 → 완료 (선형). result(판정)와 독립적인 점검 진행 상태.
 */
const ALLOWED: Record<PcStatus, PcStatus[]> = {
  진행: ['완료'],
  완료: [],
};

const FORWARD: Record<PcStatus, PcStatus | null> = {
  진행: '완료',
  완료: null,
};

export function canTransition(from: PcStatus, to: PcStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function nextStatus(s: PcStatus): PcStatus | null {
  return FORWARD[s];
}

/** 주 액션 버튼 라벨. */
export function nextActionLabel(s: PcStatus): string | null {
  return { 진행: '점검 완료', 완료: null }[s];
}
