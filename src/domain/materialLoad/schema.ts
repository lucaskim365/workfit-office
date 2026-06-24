import { z } from 'zod';

/**
 * 자재 투입 materialLoads. PK=id. 조회전용.
 *
 * 자재 투입(Material Loading) — 작업지시 BOM 대비 실투입 내역.
 * (와이어프레임 prod-screens-2.MaterialLoadContent 의 인라인 ROWS 이관)
 * 컬럼: 자재코드(mat)·자재명(name)·투입 LOT(lot)·소요량(req)·실투입(actual)·상태(state).
 */
export const ML_STATE = ['정상', '초과'] as const;

export const materialLoadSchema = z.object({
  /** 결정적 문서 ID(ML-01~). */
  id: z.string().min(1),
  /** 자재코드. */
  mat: z.string().min(1, '자재코드는 필수입니다'),
  /** 자재명. */
  name: z.string().min(1, '자재명은 필수입니다'),
  /** 투입 LOT 번호. */
  lot: z.string().min(1, '투입 LOT은 필수입니다'),
  /** 소요량(BOM 기준, 표시 문자열). */
  req: z.string().default(''),
  /** 실투입량(표시 문자열). */
  actual: z.string().default(''),
  /** 투입 상태 — 정상/초과. */
  state: z.enum(ML_STATE),
});

export type MaterialLoad = z.infer<typeof materialLoadSchema>;
