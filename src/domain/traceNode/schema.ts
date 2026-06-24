import { z } from 'zod';

/**
 * LOT 계보 추적(TraceNode) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설계서 LOT 계보 추적 traceNodes. PK=id. 조회전용.
 * 각 노드 1건 = 1 도큐먼트. 상태머신 없음(추적 결과 스냅샷).
 */
export const TR_NODE_TYPES = ['제품', '반제품', '자재'] as const;

export const traceNodeSchema = z.object({
  /** PK — 노드 식별자(N0, N1...). */
  id: z.string().min(1),
  /** 계보 트리 깊이(0=완제품). */
  level: z.number().int().nonnegative(),
  type: z.enum(TR_NODE_TYPES),
  lot: z.string(),
  name: z.string(),
  code: z.string(),
  /** 협력사(자재 노드에만 존재). */
  vendor: z.string().optional(),
  qty: z.number(),
  unit: z.string(),
  /** 검사 판정(합격·조건부·특채·불합격·진행중). */
  insp: z.string(),
  inspType: z.string(),
  extra: z.string(),
  /** NCR 연계 여부. */
  ncr: z.boolean(),
  /** 품질 이력 이벤트 = [이벤트명, 시각, 상세, tone]. */
  events: z.array(z.tuple([z.string(), z.string(), z.string(), z.string()])),
});

export type TraceNode = z.infer<typeof traceNodeSchema>;
