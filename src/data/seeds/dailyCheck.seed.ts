import type { DailyCheck } from '@/domain/dailyCheck/schema';

/**
 * 일상점검 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 equip-daily-check.jsx 인라인 DC_EQUIP 이관)
 */
export const DAILY_CHECK_SEED: DailyCheck[] = [
  { code: 'EQ-CMP02', name: 'CMP 02호기', done: 7, total: 11, state: '진행중' },
  { code: 'EQ-ETCH01', name: 'Etch 01호기', done: 9, total: 9, state: '완료' },
  { code: 'EQ-PHO05', name: 'Photo 05호기', done: 8, total: 8, state: '완료' },
  { code: 'EQ-DEP03', name: 'Depo 03호기', done: 0, total: 10, state: '미점검' },
  { code: 'EQ-IMP02', name: 'Implant 02호기', done: 10, total: 10, state: '완료' },
  { code: 'EQ-OVEN05', name: 'Thermal 05호기', done: 3, total: 9, state: '진행중' },
  { code: 'EQ-CLN04', name: 'Clean 04호기', done: 0, total: 8, state: '미점검' },
];
