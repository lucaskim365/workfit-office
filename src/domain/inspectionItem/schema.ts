import { z } from 'zod';

/**
 * 검사항목(InspectionItem) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 2.5 품질 기준정보 `inspectionItems`. 채번 QI-{group}-NN.
 * ⚠ 설비 점검항목(equipCheckItems)과 이름이 겹치나 별개 마스터다(설계서 2.0 이름충돌).
 */
export const QI_GROUPS = ['치수', '외관', '중량', '온도', '물성', '전기'] as const;
export const QI_TYPES = ['계량', '계수'] as const;
export const QI_SAMPLING = ['샘플링', '전수'] as const;
export const QI_SEVERITY = ['치명', '주요', '경미'] as const;
export const QI_STATE = ['사용', '미사용'] as const;
/** 적용 검사 단계 — 수입(IQC)·공정(PQC)·출하(OQC). */
export const QI_STAGES = ['수입', '공정', '출하'] as const;

export const inspectionItemSchema = z.object({
  code: z.string().min(1, '검사항목 코드는 필수입니다'),
  name: z.string().min(1, '검사항목명은 필수입니다'),
  group: z.enum(QI_GROUPS),
  /** 계량치(측정값) vs 계수치(외관·판정). */
  type: z.enum(QI_TYPES),
  unit: z.string().default('-'),
  method: z.string().default(''),
  /** 사용 계측기 코드(gauges 참조). 해당 없으면 '-'. */
  gage: z.string().default('-'),
  /** 계량치 규격 — 기준값/상한/하한. 계수치이거나 단측 규격이면 null. */
  nominal: z.number().nullable().default(null),
  usl: z.number().nullable().default(null),
  lsl: z.number().nullable().default(null),
  /** 표시 소수 자릿수. */
  digits: z.number().int().nonnegative().default(0),
  /** 계수치 판정 기준 문구. */
  judge: z.string().default(''),
  sampling: z.enum(QI_SAMPLING),
  severity: z.enum(QI_SEVERITY),
  stages: z.array(z.enum(QI_STAGES)).default([]),
  /** 연계 불량코드(defectCodes 참조). */
  defect: z.string().default(''),
  state: z.enum(QI_STATE).default('사용'),
  /** 개정일(YYYY-MM-DD). */
  updated: z.string().default(''),
});

export type InspectionItem = z.infer<typeof inspectionItemSchema>;

/** 신규 작성용(코드·항목명·그룹·유형만 필수) — 부분 검증. */
export const inspectionItemDraftSchema = inspectionItemSchema.partial().extend({
  code: z.string().min(1, '검사항목 코드는 필수입니다'),
  name: z.string().min(1, '검사항목명은 필수입니다'),
  group: z.enum(QI_GROUPS),
  type: z.enum(QI_TYPES),
});
export type InspectionItemDraft = z.infer<typeof inspectionItemDraftSchema>;
