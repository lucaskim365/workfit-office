import { z } from 'zod';

/**
 * 설비 제원·스펙(EquipmentSpec) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설계서 2.4 설비제원 `equipmentSpecs`. PK=type. 조회전용.
 * 설비 유형(CMP/Etch/…) 1개 = 1 도큐먼트. 스펙 정의(defs)·설비별 제원(meas)을 type별로 병합 임베드.
 */

/** 설비별 측정값 판정 상태. */
export const EQSPEC_MEAS_STATE = ['표준', '주의', '이탈'] as const;

/** 스펙 항목 정의 1행 = 7요소 튜플 [항목명, 데이터타입, 단위, 표준값, 하한, 상한, 필수여부]. */
export const equipmentSpecDefSchema = z.tuple([
  z.string(),
  z.string(),
  z.string(),
  z.string(),
  z.string(),
  z.string(),
  z.boolean(),
]);
export type EquipmentSpecDef = z.infer<typeof equipmentSpecDefSchema>;

/** 설비별 제원 측정 1행. */
export const equipmentSpecMeasSchema = z.object({
  eq: z.string(),
  name: z.string(),
  vals: z.array(z.string()),
  state: z.enum(EQSPEC_MEAS_STATE),
  /** 이탈/주의 컬럼 인덱스. */
  flag: z.array(z.number().int().nonnegative()),
});
export type EquipmentSpecMeas = z.infer<typeof equipmentSpecMeasSchema>;

export const equipmentSpecSchema = z.object({
  type: z.string().min(1, '설비 유형은 필수입니다'), // PK
  name: z.string().min(1),
  desc: z.string().default(''),
  /** 스펙 항목 수. */
  items: z.number().int().nonnegative().default(0),
  /** 보유 설비 대수. */
  eq: z.number().int().nonnegative().default(0),
  defs: z.array(equipmentSpecDefSchema).default([]),
  meas: z.array(equipmentSpecMeasSchema).default([]),
});

export type EquipmentSpec = z.infer<typeof equipmentSpecSchema>;
