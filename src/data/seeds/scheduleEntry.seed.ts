import type { ScheduleEntry } from '@/domain/scheduleEntry/schema';

/**
 * 생산 일정 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (ScheduleScreen.tsx 의 인라인 UNASSIGNED 미배정 오더 배열 이관)
 */
export const SCHEDULE_ENTRY_SEED: ScheduleEntry[] = [
  { wo: 'WO-1013', prod: '커넥터 어셈블리', qty: 2000, due: 'D-1', urgent: true },
  { wo: 'WO-1014', prod: '센서 모듈', qty: 1500, due: 'D-2', urgent: false },
  { wo: 'WO-1015', prod: '브래킷 키트', qty: 3000, due: 'D-3', urgent: false },
];
