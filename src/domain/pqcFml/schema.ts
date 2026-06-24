import { z } from 'zod';

/**
 * PQC 초·중·종물 검사(PqcFml) 도메인 스키마 — 임베드 구조(조회 전용).
 * 헤더(작업지시) + 단계별 검사상태(stages) + 측정항목(items)을 함께 로드하므로 임베드.
 * 상태머신 없는 조회 마스터다. ([[데이터_모델_설계서.md]] PQC 초중종검사 pqcFmlChecks. PK=wo.)
 */
export const FML_ITEM_TYPES = ['계량', '계수'] as const;

/** 단계별 검사상태 — 검사자(pic)·시각(time)·불량수(ng). */
export const stageInfoSchema = z.object({
  st: z.string(),
  pic: z.string(),
  time: z.string(),
  ng: z.number().int().nonnegative(),
});
export type StageInfo = z.infer<typeof stageInfoSchema>;

/** 측정항목 — 계량치(lsl~usl·val·unit) vs 계수치(val=불량수). */
export const itemRowSchema = z.object({
  n: z.string(),
  t: z.enum(FML_ITEM_TYPES),
  lsl: z.number().optional(),
  usl: z.number().optional(),
  val: z.number(),
  unit: z.string().optional(),
});
export type ItemRow = z.infer<typeof itemRowSchema>;

export const pqcFmlSchema = z.object({
  wo: z.string().min(1), // 작업지시번호(PK)
  item: z.string(),
  code: z.string(),
  line: z.string(),
  equip: z.string(),
  proc: z.string(),
  qty: z.number().nonnegative(),
  done: z.number().nonnegative(),
  lot: z.string(),
  active: z.string(),
  /** 단계 키(first/mid/last)별 검사상태. 화면이 키로 접근하니 구조 보존. */
  stages: z.record(z.string(), stageInfoSchema),
  items: z.array(itemRowSchema).default([]),
});
export type PqcFml = z.infer<typeof pqcFmlSchema>;
