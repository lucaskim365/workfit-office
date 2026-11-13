import { z } from 'zod';

/** 저장소 검증 — 타입은 types.ts 와 같다 */
const jsonArray = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => {
    if (typeof v === 'string') {
      try {
        return JSON.parse(v);
      } catch {
        return [];
      }
    }
    return v ?? [];
  }, z.array(item));

export const authRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  desc: z.string().nullish().transform((v) => v ?? ''),
  permissions: jsonArray(z.string()),
  kind: z.enum(['super', 'base', 'custom']),
  use: z.boolean().nullish().transform((v) => v ?? true),
  sort: z.number().nullish().transform((v) => v ?? 0),
  migratedFrom: z.string().nullish().transform((v) => v ?? ''),
  updatedAt: z.string().nullish().transform((v) => v ?? ''),
  updatedBy: z.string().nullish().transform((v) => v ?? ''),
});

export const authAssignmentSchema = z.object({
  id: z.string().min(1),
  roleId: z.string().min(1),
  targetType: z.enum(['USER', 'DEPT', 'POSITION', 'DEPT_HEAD']),
  targetId: z.string().nullish().transform((v) => v ?? ''),
  targetSub: z.boolean().nullish().transform((v) => v ?? false),
  positionMode: z.enum(['EQ', 'GTE']).nullish().transform((v) => v ?? 'EQ'),
  scopeType: z.enum(['ALL', 'OWN_DEPT', 'DEPTS']),
  scopeDeptIds: jsonArray(z.string()),
  scopeSub: z.boolean().nullish().transform((v) => v ?? true),
  regBy: z.string().nullish().transform((v) => v ?? ''),
  regAt: z.string().nullish().transform((v) => v ?? ''),
});
