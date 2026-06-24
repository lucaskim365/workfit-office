import { z } from 'zod';

/**
 * 설계서 입고보류 holdingStock. PK=lot. 조회전용. (IQC 흐름)
 *
 * 수입검사(IQC) 완료 전 격리/보류 중인 입고 자재 마스터.
 * 와이어프레임 wms-screens.jsx 의 인라인 ROWS 이관.
 */
export const holdingStockSchema = z.object({
  /** 추적번호(LOT) — PK·고유. */
  lot: z.string().min(1, '추적번호는 필수입니다'),
  /** 품목 코드. */
  code: z.string().min(1, '품목 코드는 필수입니다'),
  /** 품목명. */
  name: z.string().default(''),
  /** 보류 사유 — IQC 대기·불합격·조건부 합격 등. */
  reason: z.string().default(''),
  /** 격리 위치. */
  loc: z.string().default(''),
  /** 보류 수량(EA). */
  qty: z.number().nonnegative().default(0),
  /** 상태 — 검사대기·보류. */
  status: z.string().default(''),
});

export type HoldingStock = z.infer<typeof holdingStockSchema>;
