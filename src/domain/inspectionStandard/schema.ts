import { z } from 'zod';

/**
 * 검사기준(inspectionStandards) 도메인 스키마 — header-line 정본 패턴.
 * 설계서 2.5 inspectionStandards. PK=제품code, procs[].items[] 임베드(header-line).
 * 제품 1건 = 1 도큐먼트, procs[](검사공정) 안에 items[](검사항목 규격) 3중 중첩.
 * bounded master라 항상 함께 로드 → 임베드. ([[data-layer-pattern]])
 */
export const ITEM_SPEC_TYPE = ['계량', '계수'] as const;
export const ITEM_SPEC_SEV = ['치명', '주요', '경미'] as const;
export const PROC_STAGE = ['IQC', 'PQC', 'OQC'] as const;

/** 검사항목 규격 (최하위 라인) */
export const itemSpecSchema = z.object({
  name: z.string(),
  code: z.string(), // 검사항목코드
  type: z.enum(ITEM_SPEC_TYPE),
  usl: z.string().optional(),
  lsl: z.string().optional(),
  spec: z.string(),
  method: z.string(),
  sampling: z.string(),
  sev: z.enum(ITEM_SPEC_SEV),
  use: z.boolean(),
});
export type ItemSpec = z.infer<typeof itemSpecSchema>;

/** 검사공정 (중간 라인) */
export const procSchema = z.object({
  id: z.string(),
  step: z.number().int(),
  name: z.string(),
  stage: z.enum(PROC_STAGE),
  aql: z.number(),
  level: z.string(),
  lot: z.string(),
  n: z.number().int(),
  ac: z.number().int(),
  re: z.number().int(),
  items: z.array(itemSpecSchema).default([]),
});
export type Proc = z.infer<typeof procSchema>;

/** 검사기준 헤더 — 제품(PK=code) */
export const inspectionStandardSchema = z.object({
  code: z.string().min(1), // 제품코드(PK)
  name: z.string().min(1),
  cat: z.string(),
  procs: z.array(procSchema).default([]),
});
export type InspectionStandard = z.infer<typeof inspectionStandardSchema>;
