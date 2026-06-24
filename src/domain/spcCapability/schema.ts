import { z } from 'zod';

/**
 * 설계서 SPC 공정능력 spcCapability. PK=id. 조회전용.
 * 단일 진실 공급원(SSOT) — 타입·검증을 이 스키마에서 파생한다.
 * 상태머신 없는 모니터링 조회 전용 마스터다.
 */
export const spcCapabilitySchema = z.object({
  /** PK — 특성 식별자(예: BRK-OD). */
  id: z.string().min(1, '특성 ID는 필수입니다'),
  /** 제품명. */
  prod: z.string(),
  /** 품목 코드. */
  code: z.string(),
  /** 측정 특성명. */
  char: z.string(),
  /** 측정 단위. */
  unit: z.string(),
  /** 공정 코드. */
  proc: z.string(),
  /** 표본 수. */
  n: z.number(),
  /** 공정평균. */
  mean: z.number(),
  /** 표준편차. */
  sigma: z.number(),
  /** 규격 하한(LSL). */
  lsl: z.number(),
  /** 규격 상한(USL). */
  usl: z.number(),
  /** 목표값. */
  target: z.number(),
});

export type SpcCapability = z.infer<typeof spcCapabilitySchema>;
