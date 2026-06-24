import { z } from 'zod';

/**
 * 작업장(WorkCenter) 도메인 스키마 — 설비 매핑 + 연결 공정.
 * 설비(eqs)는 표시 최적화를 위해 임베드. ([[데이터_모델_설계서.md]] workCenters)
 */
export const EQ_STATUS = ['가동', '대기', '정비'] as const;

export const wcEquipSchema = z.object({
  name: z.string(),
  kind: z.string(),
  capa: z.number().int().nonnegative(),
  status: z.enum(EQ_STATUS),
});
export type WcEquip = z.infer<typeof wcEquipSchema>;

export const workCenterSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  line: z.string().default(''),
  dept: z.string().default(''),
  shift: z.string().default(''),
  crew: z.number().int().nonnegative().default(0),
  capa: z.number().int().min(0).max(100).default(0),
  procs: z.array(z.string()).default([]),
  eqs: z.array(wcEquipSchema).default([]),
});
export type WorkCenter = z.infer<typeof workCenterSchema>;
