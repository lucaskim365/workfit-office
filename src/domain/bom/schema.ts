import { z } from 'zod';

/**
 * BOM(자재명세서) 도메인 스키마 — header-line 정본 패턴.
 * 헤더(boms) + 라인(items)·이력(revisions)을 함께 로드하므로 임베드.
 * 라인 규모가 크거나 독립 쿼리가 필요한 트랜잭션(예: salesOrders)은 서브컬렉션 사용.
 * ([[데이터_모델_설계서.md]] boms / bomItems)
 */
export const BOM_KIND = ['제품', '반제품', '원자재', '부자재'] as const;

export const bomItemSchema = z.object({
  lvl: z.number().int().nonnegative(),
  code: z.string(),
  name: z.string(),
  kind: z.enum(BOM_KIND),
  qty: z.number().nonnegative(),
  unit: z.string(),
  ext: z.number().nonnegative(),
  price: z.number().nullable().default(null),
  proc: z.string().default(''),
  loss: z.number().nonnegative().default(0),
});
export type BomItem = z.infer<typeof bomItemSchema>;

export const bomRevisionSchema = z.object({
  rev: z.string(),
  date: z.string(),
  by: z.string(),
  note: z.string().default(''),
  cur: z.boolean().optional(),
});
export type BomRevision = z.infer<typeof bomRevisionSchema>;

export const bomSchema = z.object({
  code: z.string().min(1), // 제품코드(PK)
  name: z.string().min(1),
  rev: z.string().default('A'),
  items: z.array(bomItemSchema).default([]),
  revisions: z.array(bomRevisionSchema).default([]),
});
export type Bom = z.infer<typeof bomSchema>;
