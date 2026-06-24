import type { AgvRobot } from '@/domain/agvRobot/schema';

/**
 * AGV 물류로봇 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-3.jsx 의 인라인 ROBOTS 이관)
 */
export const AGV_ROBOT_SEED: AgvRobot[] = [
  { id: 'AGV-01', task: 'A-1-2-1 → C-라인대기', bat: 86, st: '이동중' },
  { id: 'AGV-02', task: '입고장 → A-3-1-4', bat: 64, st: '이동중' },
  { id: 'AMR-03', task: '대기', bat: 42, st: '대기' },
  { id: 'AGV-04', task: '충전중', bat: 18, st: '충전' },
];
