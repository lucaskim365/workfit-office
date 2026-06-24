import { z } from 'zod';

/**
 * 공정 라우팅(Routing) 도메인 스키마 — header-line 정본 패턴.
 * 헤더(routings) + 공정순서(steps) 임베드. ([[데이터_모델_설계서.md]] routings / routingSteps)
 */
export const OP_KIND = ['가공', '검사', '이동'] as const;

export const routingStepSchema = z.object({
  op: z.string(),
  name: z.string(),
  wc: z.string().default(''),
  eq: z.string().default(''),
  kind: z.enum(OP_KIND),
  setup: z.number().int().nonnegative().default(0),
  ct: z.number().int().nonnegative().default(0),
  crew: z.number().int().nonnegative().default(1),
  yield: z.number().min(0).max(100).default(100),
});
export type RoutingStep = z.infer<typeof routingStepSchema>;

export const routingSchema = z.object({
  code: z.string().min(1), // 제품코드(PK)
  name: z.string().min(1),
  rev: z.string().default('A'),
  line: z.string().default(''),
  steps: z.array(routingStepSchema).default([]),
});
export type Routing = z.infer<typeof routingSchema>;
