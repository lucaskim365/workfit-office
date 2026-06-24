import { T } from '@/shared/theme/tokens';
import type { Shift, ShiftRotation } from '@/domain/shift/schema';

/** 근무조 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스. (와이어프레임 shift-mgmt.jsx) */
export const SHIFT_SEED: Shift[] = [
  { code: 'D', name: '주간 (Day)', start: 8, end: 20, brk: 90, net: 10.5, color: T.teal },
  { code: 'N', name: '야간 (Night)', start: 20, end: 8, brk: 90, net: 10.5, color: T.navy },
  { code: 'A', name: '상주 (관리)', start: 9, end: 18, brk: 60, net: 8.0, color: T.blue },
];

export const SHIFT_ROTATION_SEED: ShiftRotation[] = [
  { crew: 'A조', lead: '김주임', n: 8, plan: ['주간', '주간', '야간', '야간', '휴무', '휴무', '주간'] },
  { crew: 'B조', lead: '이주임', n: 8, plan: ['야간', '야간', '휴무', '휴무', '주간', '주간', '야간'] },
  { crew: 'C조', lead: '박주임', n: 7, plan: ['휴무', '휴무', '주간', '주간', '야간', '야간', '휴무'] },
];
