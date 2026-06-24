import { z } from 'zod';

/**
 * 설계서 부적합 심의 mrbCases. PK=no.
 * MRB(Material Review Board) 부적합 심의 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 채번 MRB-YYMMDD-NNN. 상태머신 심의대기→심의중→의결완료(+보류 분기).
 *
 * NCR에서 회부된 부적합품의 처분(특채·재작업·반품·폐기 등)을 심의·의결.
 */
export const MRB_SEVERITY = ['치명', '주요', '경미'] as const;
export const MRB_STATUS = ['심의대기', '심의중', '의결완료', '보류'] as const;

/** 심의 위원 의견 [역할, 이름, 의견]. */
export const mrbBoardSchema = z.tuple([z.string(), z.string(), z.string()]);

export const mrbCaseSchema = z.object({
  /** PK — MRB-YYMMDD-NNN. */
  no: z.string().min(1),
  /** 연계 NCR 번호(nonconformances 참조). */
  ncr: z.string().default(''),
  date: z.string().default(''),
  /** 심의 회의 일시. */
  meeting: z.string().default(''),
  code: z.string().default(''),
  name: z.string().default(''),
  lot: z.string().default(''),
  /** 부적합(불량) 유형명. */
  defect: z.string().default(''),
  sev: z.enum(MRB_SEVERITY),
  /** 심의 수량. */
  qty: z.number().int().nonnegative().default(0),
  unit: z.string().default('EA'),
  /** 추정 손실액(원). */
  loss: z.number().nonnegative().default(0),
  status: z.enum(MRB_STATUS).default('심의대기'),
  /** 의결 처분(미의결 시 null). */
  decision: z.string().nullable().default(null),
  /** 심의 위원 의견 [역할, 이름, 의견]. */
  board: z.array(mrbBoardSchema).default([]),
  /** 의결 사유. */
  reason: z.string().default(''),
});

export type MrbCase = z.infer<typeof mrbCaseSchema>;

/** 신규 안건 상정용(번호·상태는 repo가 채움). */
export const mrbCaseDraftSchema = mrbCaseSchema.partial().extend({
  sev: z.enum(MRB_SEVERITY),
  name: z.string().min(1, '품목명은 필수입니다'),
  defect: z.string().min(1, '부적합 유형은 필수입니다'),
});
export type MrbCaseDraft = z.infer<typeof mrbCaseDraftSchema>;
