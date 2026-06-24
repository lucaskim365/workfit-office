import { z } from 'zod';

/**
 * 검교정 계획·실적(Calibration) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설계서 검교정 calibrations. PK=id. 상태머신 예정→진행중→완료, 예정→지연, 지연→진행중.
 * 채번 CL-YYMMDD-NNN.
 *
 * 계측기 검교정 계획 수립~실시~성적서 등록까지의 계획·실적 기록.
 */
export const CAL_KIND = ['내부', '외부', '공인(KOLAS)'] as const;
export const CAL_RESULT = ['합격', '조정후합격', '부적합', '-'] as const;
export const CAL_STATUS = ['예정', '진행중', '완료', '지연'] as const;

export const calibrationSchema = z.object({
  /** PK — CL-YYMMDD-NNN. */
  id: z.string().min(1),
  /** 계측기명. */
  gage: z.string().default(''),
  /** 계측기 ID. */
  gid: z.string().default(''),
  /** 검교정 주기. */
  cycle: z.string().default(''),
  /** 계획일. */
  plan: z.string().default(''),
  /** 실시일(미실시 '—'). */
  done: z.string().default('—'),
  kind: z.enum(CAL_KIND),
  /** 검교정 기관. */
  org: z.string().default(''),
  /** 성적서 번호. */
  cert: z.string().default('—'),
  /** 기준기(표준). */
  std: z.string().default(''),
  result: z.enum(CAL_RESULT).default('-'),
  status: z.enum(CAL_STATUS).default('예정'),
  /** 검교정 측정점 [표준값, 측정값, 편차, 허용오차]. */
  pts: z.array(z.array(z.string())).default([]),
});

export type Calibration = z.infer<typeof calibrationSchema>;

/** 신규 등록용(번호·상태는 repo가 채움). */
export const calibrationDraftSchema = calibrationSchema.partial().extend({
  kind: z.enum(CAL_KIND),
  gage: z.string().min(1, '계측기명은 필수입니다'),
  gid: z.string().min(1, '계측기 ID는 필수입니다'),
});
export type CalibrationDraft = z.infer<typeof calibrationDraftSchema>;
