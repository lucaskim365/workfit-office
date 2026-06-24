import { z } from 'zod';

/**
 * 생산 LOT 추적(투입자재) prodLotTraces. PK=id. 조회전용.
 *
 * 와이어프레임 prod-screens-2.LotTraceContent 의 인라인 `MATS`(투입 자재 계보) 이관.
 * 각 튜플 4컬럼 = 자재코드/품목명/투입LOT/공급처. 채번 LT-NN.
 */
export const prodLotTraceSchema = z.object({
  /** 결정적 문서 ID(LT-01 ~). */
  id: z.string().min(1),
  /** 자재 코드. */
  mat: z.string().min(1),
  /** 품목명. */
  name: z.string().min(1),
  /** 투입 LOT 번호. */
  lot: z.string().min(1),
  /** 공급처. */
  vendor: z.string().min(1),
});

export type ProdLotTrace = z.infer<typeof prodLotTraceSchema>;
