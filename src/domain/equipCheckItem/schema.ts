import { z } from 'zod';

/**
 * 설비 점검항목(EquipCheckItem) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 2.4 설비점검항목 `equipCheckItems`. PK=type. (품질 inspectionItems와 별개)
 * 설비 유형(type) 1개 = 1 도큐먼트. 점검항목 배열을 임베드하는 조회 마스터다.
 */
export const ECI_KINDS = ['일상', '정기'] as const;

/** 임베드 행 — 설비 유형 도큐먼트에 담기는 개별 점검항목. */
export const checkItemRowSchema = z.object({
  /** 점검 부위(그룹핑 키). */
  area: z.string().min(1),
  name: z.string().min(1),
  /** 일상 점검 vs 정기 점검. */
  kind: z.enum(ECI_KINDS),
  cycle: z.string().default(''),
  method: z.string().default(''),
  /** 기준값(없으면 ''). */
  std: z.string().default(''),
  /** 하한(LSL). */
  lo: z.string().default(''),
  /** 상한(USL). */
  hi: z.string().default(''),
  unit: z.string().default('-'),
  /** 합격 기준 문구. */
  pass: z.string().default(''),
  /** 불합격(NG) 시 조치. */
  action: z.string().default(''),
});
export type CheckItemRow = z.infer<typeof checkItemRowSchema>;

export const equipCheckItemSchema = z.object({
  /** 설비 유형 코드 = PK = 문서 ID (예: CMP). */
  type: z.string().min(1, '설비 유형은 필수입니다'),
  items: z.array(checkItemRowSchema).default([]),
});
export type EquipCheckItem = z.infer<typeof equipCheckItemSchema>;
