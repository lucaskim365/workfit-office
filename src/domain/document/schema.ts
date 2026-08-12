import { z } from 'zod';

export const documentBoxSchema = z.object({
  id: z.string(),
  name: z.string(),
  desc: z.string().optional()
});

export const ruleVersionSchema = z.object({
  version: z.string(),
  effectiveDate: z.string(), // 시행일
  revisedDate: z.string(), // 개정일
  reason: z.string(), // 개정사유
  attachments: z.array(z.string()).default([]),
  author: z.string(),
  date: z.string()
});

export const documentSchema = z.object({
  id: z.number(),
  boxId: z.string(), // 'rule' | 'manual' | 'form' | 'resource' 등
  name: z.string(),
  desc: z.string().optional(),
  attachments: z.array(z.string()).default([]),
  dept: z.string(),
  author: z.string(),
  date: z.string(),
  version: z.string().optional(), // 규정인 경우 최신 버전 표시
  isRule: z.boolean().default(false), // 규정 문서 여부
  versions: z.array(ruleVersionSchema).default([]) // 규정 개정 이력들
});

export type DocumentBox = z.infer<typeof documentBoxSchema>;
export type RuleVersion = z.infer<typeof ruleVersionSchema>;
export type DocumentItem = z.infer<typeof documentSchema>;
