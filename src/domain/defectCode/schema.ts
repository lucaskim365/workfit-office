import { z } from 'zod';

/**
 * 불량코드(DefectCode) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 2.5 defectCodes ★통합. PK=code.
 * 평면 마스터(코드별 1 도큐먼트). group(AP/DIM/WT/PR/ST/EL)은 표시용 분류이며,
 * 그룹의 표시 메타(한글명·tone)는 데이터가 아니라 화면 상수(GROUP_META)로 둔다.
 */
export const DEF_GROUPS = ['AP', 'DIM', 'WT', 'PR', 'ST', 'EL'] as const;
export const DEF_GRADE = ['치명', '주요', '경미'] as const;

export const defectCodeSchema = z.object({
  code: z.string().min(1, '불량코드는 필수입니다'),
  ko: z.string().min(1, '국문 불량명은 필수입니다'),
  en: z.string().default(''),
  /** 소속 그룹코드(표시용 대분류). */
  group: z.enum(DEF_GROUPS),
  /** 발생 공정. */
  proc: z.string().default(''),
  grade: z.enum(DEF_GRADE),
  /** 연계 검사항목코드(inspectionItems 참조). 해당 없으면 '-'. */
  insp: z.string().default('-'),
  /** 누적 발생건수(표시용). */
  qty: z.number().nonnegative().default(0),
  /** 최근 추이(표시용). */
  trend: z.array(z.number()).default([]),
  use: z.boolean().default(true),
});

export type DefectCode = z.infer<typeof defectCodeSchema>;

/** 신규 작성용(코드·국문명·그룹·등급만 필수) — 부분 검증. */
export const defectCodeDraftSchema = defectCodeSchema.partial().extend({
  code: z.string().min(1, '불량코드는 필수입니다'),
  ko: z.string().min(1, '국문 불량명은 필수입니다'),
  group: z.enum(DEF_GROUPS),
  grade: z.enum(DEF_GRADE),
});
export type DefectCodeDraft = z.infer<typeof defectCodeDraftSchema>;
