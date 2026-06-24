import { z } from 'zod';

/**
 * 재공 현황 wipStatus. PK=id. 조회전용.
 * 공정별 재공(WIP) LOT 추적 — 실시간 위치·수량·체류시간.
 * (와이어프레임 prod-screens.WipContent 의 인라인 ROWS 이관)
 */
export const WIP_STATUS = ['정상', '지연', '병목'] as const;

export const wipStatusSchema = z.object({
  /** 결정적 PK(WIP-NN). */
  id: z.string().min(1),
  /** LOT 번호. */
  lot: z.string().min(1),
  /** 품목 코드. */
  item: z.string().min(1),
  /** 현재 공정. */
  proc: z.string().min(1),
  /** 설비 코드. */
  eq: z.string().min(1),
  /** 재공 수량(EA). */
  qty: z.number().int().nonnegative(),
  /** 공정 체류시간(표시 문구, 예: '2h 12m'). */
  elapsed: z.string().min(1),
  /** 진행 상태. */
  status: z.enum(WIP_STATUS),
});

export type WipStatus = z.infer<typeof wipStatusSchema>;
