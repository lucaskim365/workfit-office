import { z } from 'zod';

/**
 * 설비(Equipment) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설계서 2.4 `equipments` ★정본 — 설비관리 모듈의 마스터. 나머지 설비 엔티티가 FK 참조.
 * (제원·점검항목·알람·유닛은 별도 슬라이스/서브컬렉션)
 */
export const EQUIP_STATE = ['가동', '대기', '정지', '고장'] as const;
export const EQUIP_USE = ['사용', '미사용'] as const;

export const equipmentSchema = z.object({
  code: z.string().min(1, '설비코드는 필수입니다'),
  name: z.string().min(1, '설비명은 필수입니다'),
  /** 설비 유형(CMP/Etch/Photo/Depo/Implant/Thermal/Clean…). */
  type: z.string().default(''),
  model: z.string().default(''),
  maker: z.string().default(''),
  line: z.string().default(''),
  loc: z.string().default(''),
  /** 도입일. */
  date: z.string().default(''),
  mgr: z.string().default(''),
  state: z.enum(EQUIP_STATE).default('대기'),
  /** 정격 전력(kW). */
  power: z.string().default(''),
  volt: z.string().default(''),
  use: z.enum(EQUIP_USE).default('사용'),
  ip: z.string().default(''),
});

export type Equipment = z.infer<typeof equipmentSchema>;

/** 신규 작성용(코드·명·유형만 필수). */
export const equipmentDraftSchema = equipmentSchema.partial().extend({
  code: z.string().min(1, '설비코드는 필수입니다'),
  name: z.string().min(1, '설비명은 필수입니다'),
});
export type EquipmentDraft = z.infer<typeof equipmentDraftSchema>;
