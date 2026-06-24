import { z } from 'zod';

/**
 * Gage R&R(MSA) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 MSA gageRrStudies. PK=id. 조회전용.
 */
export const gageRrSchema = z.object({
  /** PK — MSA 분석 ID (예: MSA-2603-01). */
  id: z.string().min(1),
  /** 계측기 명칭. */
  gage: z.string(),
  /** 계측기 ID(gauges 참조). */
  gid: z.string(),
  /** 측정 특성명. */
  char: z.string(),
  unit: z.string(),
  /** 분석 방법 — ANOVA / 평균-범위. */
  method: z.string(),
  /** 작업자 수. */
  ops: z.number(),
  /** 부품 수. */
  parts: z.number(),
  /** 측정 횟수(반복). */
  trials: z.number(),
  /** 반복성(EV) 산포. */
  ev: z.number(),
  /** 재현성(AV) 산포. */
  av: z.number(),
  /** 부품간(PV) 산포. */
  pv: z.number(),
  /** 공차. */
  tol: z.number(),
  /** 분석 기준월(YYYY-MM). */
  date: z.string(),
});

export type GageRr = z.infer<typeof gageRrSchema>;
