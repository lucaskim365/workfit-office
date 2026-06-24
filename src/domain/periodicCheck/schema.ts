import { z } from 'zod';

/**
 * 정기 점검(Periodic Check) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설계서 설비 보전·점검 / `periodicChecks`. 상태머신 진행→완료. 채번 PC-YYMM-NNN(월단위).
 *
 * 설비별 정기 점검 실적(점검자·소요시간·NG·판정·차기 점검일).
 */
export const PC_RESULT = ['합격', '조건부', '불합격'] as const;
export const PC_STATUS = ['진행', '완료'] as const;

export const periodicCheckSchema = z.object({
  /** PK — PC-YYMM-NNN. */
  no: z.string().min(1),
  /** 점검일(YYYY-MM-DD). */
  date: z.string().default(''),
  /** 대상 설비. */
  eq: z.string().default(''),
  /** 점검 주기(주간·월간·분기·연간). */
  type: z.string().default(''),
  /** 점검팀. */
  team: z.string().default(''),
  /** 점검자. */
  worker: z.string().default(''),
  /** 소요시간(분). */
  dur: z.string().default(''),
  /** 점검 항목 수. */
  items: z.number().int().nonnegative().default(0),
  /** NG(비정상) 항목 수. */
  ng: z.number().int().nonnegative().default(0),
  /** 판정(합격·조건부·불합격). */
  result: z.string().default(''),
  /** 차기 점검 예정일(YYYY-MM-DD). */
  next: z.string().default(''),
  /** 진행 상태머신 — result와 무관한 점검 진행 상태. */
  status: z.enum(PC_STATUS).default('진행'),
});

export type PeriodicCheck = z.infer<typeof periodicCheckSchema>;

/** 신규 등록용(번호·상태는 repo가 채움). */
export const periodicCheckDraftSchema = periodicCheckSchema.partial().extend({
  eq: z.string().min(1, '설비는 필수입니다'),
  type: z.string().min(1, '점검 주기는 필수입니다'),
});
export type PeriodicCheckDraft = z.infer<typeof periodicCheckDraftSchema>;
