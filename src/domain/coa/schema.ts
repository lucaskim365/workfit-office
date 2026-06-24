import { z } from 'zod';

/**
 * 출하 성적서(COA, Certificate of Analysis) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설계서 출하검사(OQC) COA. 상태머신 발행대기→발행완료→전송완료. 채번 COA-YYMMDD-NNN.
 *
 * 출하검사 합격 LOT의 검사 성적을 고객 제출용 문서로 발행한다.
 */
export const COA_STATUS = ['발행대기', '발행완료', '전송완료'] as const;

export const coaSchema = z.object({
  /** PK — COA-YYMMDD-NNN. */
  no: z.string().min(1),
  /** 연계 출하지시(SO). */
  so: z.string().default(''),
  code: z.string().default(''),
  name: z.string().default(''),
  cust: z.string().default(''),
  dest: z.string().default(''),
  qty: z.number().nonnegative().default(0),
  unit: z.string().default('EA'),
  lot: z.string().default(''),
  date: z.string().default(''),
  /** 검사자·품질책임자. */
  insp: z.string().default(''),
  mgr: z.string().default(''),
  /** 재질·열처리 LOT·적용 규격. */
  mat: z.string().default(''),
  heat: z.string().default('—'),
  std: z.string().default(''),
  status: z.enum(COA_STATUS).default('발행대기'),
  /** 성적 행 [항목, 규격, 측정값, 판정]. */
  rows: z.array(z.array(z.string())).default([]),
});

export type Coa = z.infer<typeof coaSchema>;

/** 신규 발행용(번호·상태는 repo가 채움). */
export const coaDraftSchema = coaSchema.partial().extend({
  name: z.string().min(1, '제품명은 필수입니다'),
  so: z.string().min(1, '출하지시는 필수입니다'),
});
export type CoaDraft = z.infer<typeof coaDraftSchema>;
