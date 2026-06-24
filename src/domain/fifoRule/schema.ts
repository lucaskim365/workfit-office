import { z } from 'zod';

/**
 * FIFO 출고규칙 fifoRules. PK=category. 조회전용.
 * 품목군별 선입선출(FIFO·FEFO) 불출 룰 마스터.
 * (와이어프레임 wms-screens-4.jsx 의 인라인 RULES 이관)
 */
export const FIFO_RULES = ['FIFO', 'FEFO', 'LIFO'] as const;
export const FIFO_MODES = ['강제', '권고'] as const;

export const fifoRuleSchema = z.object({
  /** 품목군(PK). */
  category: z.string().min(1, '품목군은 필수입니다'),
  /** 불출 룰 — FIFO(입고순)·FEFO(유효기한순)·LIFO. */
  rule: z.enum(FIFO_RULES),
  /** 기준일자 — 입고일자/유효기한/제조일자 등. */
  basis: z.string().min(1, '기준일자는 필수입니다'),
  /** 통제 방식 — 강제/권고. */
  mode: z.enum(FIFO_MODES),
  /** 적용 여부. */
  use: z.boolean().default(true),
});

export type FifoRule = z.infer<typeof fifoRuleSchema>;
