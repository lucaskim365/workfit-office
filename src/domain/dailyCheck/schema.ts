import { z } from 'zod';

/**
 * 설계서 2.4 일상점검 dailyChecks. PK=code.
 *
 * 설비별 일상점검 세션(상태머신) — 설비 1대당 1 도큐먼트.
 * 점검항목 템플릿(DC_ITEMS)은 화면 상수로 유지하고, 설비별 진행 세션만 데이터화한다.
 */
export const DAILY_CHECK_STATE = ['미점검', '진행중', '완료'] as const;

export const dailyCheckSchema = z.object({
  /** PK — 설비코드. */
  code: z.string().min(1),
  name: z.string().default(''),
  /** 완료 항목 수. */
  done: z.number().int().nonnegative().default(0),
  /** 전체 항목 수. */
  total: z.number().int().nonnegative().default(0),
  state: z.enum(DAILY_CHECK_STATE).default('미점검'),
});

export type DailyCheck = z.infer<typeof dailyCheckSchema>;
