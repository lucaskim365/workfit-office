import type { LineMonitor } from '@/domain/lineMonitor/schema';

/**
 * 생산 라인 모니터 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 prod-screens.LineMonitorContent 의 인라인 LINES 이관)
 */
export const LINE_MONITOR_SEED: LineMonitor[] = [
  { line: 'M-Line', item: 'WF-300-B', plan: 4000, act: 2480, eq: '가동', oee: 89 },
  { line: 'P-Line', item: 'PKG-BGA-14', plan: 2500, act: 1625, eq: '가동', oee: 84 },
  { line: 'A-Line', item: 'MOD-CAM-02', plan: 1800, act: 540, eq: '대기', oee: 61 },
];
