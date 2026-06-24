import { z } from 'zod';

/**
 * 품질등급(QualityGrade) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 2.5 품질 기준정보 `qualityGrades`. PK=code.
 */
export const QG_TYPES = ['합격', '조건부합격', '특채', '처리', '불합격'] as const;
/** 적용 검사 단계 — 수입(IQC)·공정(PQC)·출하(OQC). */
export const QG_STAGES = ['수입', '공정', '출하'] as const;

export const qualityGradeSchema = z.object({
  code: z.string().min(1, '등급 코드는 필수입니다'),
  name: z.string().min(1, '등급명은 필수입니다'),
  /** 판정 유형 — 합격/조건부합격/특채/처리/불합격. */
  type: z.enum(QG_TYPES),
  /** 등급 표시색(리터럴 hex). 화면 배지 배경색으로 사용. */
  color: z.string().default('#16a34a'),
  /** 출하 가능 여부. */
  ship: z.boolean().default(false),
  /** 재작업 대상 여부. */
  rework: z.boolean().default(false),
  /** 재고 상태값(WMS/ERP 연동 라벨). */
  stock: z.string().default(''),
  /** 재고 상태 표시 톤 키 — ok/info/warn/err/mute. */
  stockTone: z.string().default('mute'),
  /** 허용 불량 등급(치명/주요/경미). */
  allow: z.object({
    치명: z.boolean().default(false),
    주요: z.boolean().default(false),
    경미: z.boolean().default(false),
  }),
  /** 승인 단계 문구. */
  approve: z.string().default(''),
  /** 등급 단가율(%). 처리 상태 등 해당 없으면 null. */
  price: z.number().nullable().default(null),
  stages: z.array(z.enum(QG_STAGES)).default([]),
  /** 사용 여부. */
  use: z.boolean().default(true),
  /** 등급 설명. */
  desc: z.string().default(''),
});

export type QualityGrade = z.infer<typeof qualityGradeSchema>;

/** 신규 작성용(코드·명칭·유형만 필수) — 부분 검증. */
export const qualityGradeDraftSchema = qualityGradeSchema.partial().extend({
  code: z.string().min(1, '등급 코드는 필수입니다'),
  name: z.string().min(1, '등급명은 필수입니다'),
  type: z.enum(QG_TYPES),
});
export type QualityGradeDraft = z.infer<typeof qualityGradeDraftSchema>;
