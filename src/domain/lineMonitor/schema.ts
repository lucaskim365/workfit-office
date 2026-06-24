import { z } from 'zod';

/**
 * 생산 라인 모니터 lineMonitors. PK=line. 조회전용.
 * 생산 현황 모니터링(Line Monitoring) 화면의 라인별 카드 데이터.
 * (와이어프레임 prod-screens.LineMonitorContent 인라인 LINES 이관)
 */
export const lineMonitorSchema = z.object({
  /** 라인명(PK). 화면 카드 키. */
  line: z.string().min(1),
  /** 가동 품목 코드. */
  item: z.string(),
  /** 목표 수량. */
  plan: z.number(),
  /** 실적 수량. */
  act: z.number(),
  /** 설비 상태 — 가동/대기. */
  eq: z.enum(['가동', '대기']),
  /** OEE(%). */
  oee: z.number(),
});

export type LineMonitor = z.infer<typeof lineMonitorSchema>;
