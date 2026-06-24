import type { ShipmentStatus } from './schema';

/** 출하 상태머신 — 출고대기 → 피킹중 → 출고완료. ([[데이터_모델_설계서.md]] §4) */
const ALLOWED: Record<ShipmentStatus, ShipmentStatus[]> = {
  출고대기: ['피킹중'],
  피킹중: ['출고완료', '출고대기'],
  출고완료: [],
};
const FORWARD: Record<ShipmentStatus, ShipmentStatus | null> = {
  출고대기: '피킹중',
  피킹중: '출고완료',
  출고완료: null,
};

export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}
export function nextStatus(s: ShipmentStatus): ShipmentStatus | null {
  return FORWARD[s];
}
export function nextActionLabel(s: ShipmentStatus): string | null {
  return { 출고대기: '피킹 시작', 피킹중: '출고 완료', 출고완료: null }[s];
}
