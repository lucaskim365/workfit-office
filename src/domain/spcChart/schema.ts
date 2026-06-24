import { z } from 'zod';

/**
 * SPC 관리도(SpcChart) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 SPC 관리도 `spcCharts`. PK=id. 조회전용(상태머신 없음).
 */
export const SPC_STATE = ['안정', '주의', '이탈'] as const;

export const spcChartSchema = z.object({
  /** PK — 특성 식별자(예: BRK-OD). */
  id: z.string().min(1, '특성 ID는 필수입니다'),
  /** 대상 제품명. */
  prod: z.string(),
  /** 제품 코드. */
  code: z.string(),
  /** 관리 특성명. */
  char: z.string(),
  /** 측정 단위. */
  unit: z.string(),
  /** 공정 코드. */
  proc: z.string(),
  /** 부분군 크기(n). */
  n: z.number(),
  /** 관리 상태. */
  state: z.enum(SPC_STATE),
  /** 공정능력지수. */
  cpk: z.number(),
  /** X̄ 관리도 상한/중심선/하한. */
  xUcl: z.number(),
  xCl: z.number(),
  xLcl: z.number(),
  /** R 관리도 상한/중심선. */
  rUcl: z.number(),
  rCl: z.number(),
  /** 부분군 평균 시계열. */
  mean: z.array(z.number()),
  /** 부분군 범위 시계열. */
  rng: z.array(z.number()),
  /** 규칙 위반 = [점, 설명, tone] 튜플 배열(Western Electric). */
  viol: z.array(z.tuple([z.string(), z.string(), z.string()])),
});

export type SpcChart = z.infer<typeof spcChartSchema>;
