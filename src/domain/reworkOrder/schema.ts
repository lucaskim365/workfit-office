import { z } from 'zod';

/**
 * 재작업·폐기 지시(ReworkOrder) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 상태머신 지시→작업중→검증대기→완료(재작업) / 승인대기→완료(폐기). 채번 RW-/SC-YYMMDD-NNN.
 *
 * 부적합 심의(MRB)·NCR에서 확정된 처리(재작업·폐기)의 실행 지시·실적·검증 보고서.
 */
export const REWORK_TYPE = ['재작업', '폐기'] as const;
export const REWORK_STATUS = ['지시', '작업중', '검증대기', '승인대기', '완료'] as const;

export const reworkOrderSchema = z.object({
  /** PK — 재작업 RW-YYMMDD-NNN / 폐기 SC-YYMMDD-NNN. */
  no: z.string().min(1),
  type: z.enum(REWORK_TYPE),
  /** 연계 MRB 번호. */
  mrb: z.string().default(''),
  /** 연계 NCR 번호. */
  ncr: z.string().default(''),
  code: z.string().default(''),
  name: z.string().default(''),
  lot: z.string().default(''),
  /** 대상 수량. */
  qty: z.number().int().nonnegative().default(0),
  unit: z.string().default('EA'),
  pic: z.string().default(''),
  /** 처리 기한. */
  due: z.string().default(''),
  status: z.enum(REWORK_STATUS).default('지시'),
  // ── 재작업 전용(선택) ──
  /** 재작업 방법. */
  method: z.string().optional(),
  /** 투입 공정. */
  proc: z.string().optional(),
  /** 재작업 완료 수량. */
  done: z.number().int().nonnegative().optional(),
  /** 재검사 합격 수량. */
  pass: z.number().int().nonnegative().optional(),
  /** 재검사 불합격(폐기) 수량. */
  fail: z.number().int().nonnegative().optional(),
  /** 재작업 비용. */
  cost: z.number().nonnegative().optional(),
  // ── 폐기 전용(선택) ──
  /** 폐기 방법. */
  dmethod: z.string().optional(),
  /** 폐기 승인자. */
  approver: z.string().optional(),
  /** 폐기 손실액. */
  loss: z.number().nonnegative().optional(),
  /** 회수액(매각). */
  recover: z.number().nonnegative().optional(),
});

export type ReworkOrder = z.infer<typeof reworkOrderSchema>;

/** 신규 발행용(번호·상태는 repo가 채움). */
export const reworkOrderDraftSchema = reworkOrderSchema.partial().extend({
  type: z.enum(REWORK_TYPE),
  name: z.string().min(1, '품목명은 필수입니다'),
});
export type ReworkOrderDraft = z.infer<typeof reworkOrderDraftSchema>;
