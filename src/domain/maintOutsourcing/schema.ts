import { z } from 'zod';

/**
 * 보전 외주(Maintenance Outsourcing) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설비 보전 작업을 외부 업체에 위탁한 의뢰 이력. 채번 OS-YYMM-NNN.
 *
 * 상태머신 접수→진행중→입고대기→완료 (선형 진행).
 */
export const OS_STATES = ['접수', '진행중', '입고대기', '완료'] as const;
export const OS_SEVERITY = ['중대', '주의', '경미'] as const;

export const maintOutsourcingSchema = z.object({
  /** PK — OS-YYMM-NNN. */
  no: z.string().min(1),
  /** 대상 설비. */
  eq: z.string().default(''),
  /** 수리 내용. */
  item: z.string().default(''),
  /** 수리 업체. */
  vendor: z.string().default(''),
  /** 의뢰일(MM-DD). */
  date: z.string().default(''),
  /** 수리 기간(예: '3일'). */
  dur: z.string().default(''),
  /** 수리 비용(원). */
  cost: z.number().nonnegative().default(0),
  /** 진행 상태. */
  state: z.enum(OS_STATES).default('접수'),
  /** 보증 기간(예: '6개월'). */
  warranty: z.string().default(''),
  /** 심각도. */
  sev: z.enum(OS_SEVERITY),
});

export type MaintOutsourcing = z.infer<typeof maintOutsourcingSchema>;

/** 신규 의뢰용(번호·상태는 repo가 채움). */
export const maintOutsourcingDraftSchema = maintOutsourcingSchema.partial().extend({
  eq: z.string().min(1, '설비는 필수입니다'),
  item: z.string().min(1, '수리 내용은 필수입니다'),
  vendor: z.string().min(1, '업체는 필수입니다'),
  sev: z.enum(OS_SEVERITY),
});
export type MaintOutsourcingDraft = z.infer<typeof maintOutsourcingDraftSchema>;
