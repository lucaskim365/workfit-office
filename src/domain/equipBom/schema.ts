import { z } from 'zod';

/**
 * 설계서 설비 BOM equipBoms. PK=code. 조회전용 트리.
 * 단일 BOM 트리 = 1 도큐먼트(root code가 곧 문서 PK).
 * 화면(EquipBomScreen)의 재귀 Node 구조를 z.lazy로 정의한다.
 * ([[데이터_모델_설계서.md]] equipBoms / [[data-layer-pattern]])
 */
export const BOM_LV = ['line', 'equip', 'unit', 'part'] as const;

/** 재귀 트리 노드 — 라인 > 설비 > 유닛 > 부품 4레벨. */
export const nodeSchema: z.ZodType<BomNode> = z.lazy(() =>
  z.object({
    lv: z.enum(BOM_LV),
    code: z.string().min(1),
    name: z.string().min(1),
    model: z.string().optional(),
    maker: z.string().optional(),
    state: z.string().optional(),
    qty: z.number().optional(),
    partNo: z.string().optional(),
    spare: z.string().optional(),
    cycle: z.string().optional(),
    children: z.array(nodeSchema).optional(),
  }),
);

/** 노드 타입(재귀) — z.lazy 순환 참조를 위한 명시 인터페이스. */
export interface BomNode {
  lv: (typeof BOM_LV)[number];
  code: string;
  name: string;
  model?: string;
  maker?: string;
  state?: string;
  qty?: number;
  partNo?: string;
  spare?: string;
  cycle?: string;
  children?: BomNode[];
}

/** 설비 BOM = root 노드 자체가 트리(문서 PK = root.code). */
export const equipBomSchema = nodeSchema;
export type EquipBom = BomNode;
