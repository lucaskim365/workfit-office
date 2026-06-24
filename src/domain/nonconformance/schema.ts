import { z } from 'zod';

/**
 * 부적합(Nonconformance, NCR) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설계서 2.5 `nonconformances`. 상태머신 발행→조사중→조치중→종결. 채번 NCR-YYMMDD-NNN.
 *
 * 검사 불합격·클레임 등에서 발생한 부적합품의 격리~조치~종결 보고서.
 */
export const NCR_SOURCES = ['수입검사', '공정검사', '출하검사', '고객 클레임'] as const;
export const NCR_SEVERITY = ['치명', '주요', '경미'] as const;
export const NCR_STATUS = ['발행', '조사중', '조치중', '종결'] as const;

/** 처리 단계 [라벨, 일시, 완료(1)|미완료(0)]. */
export const ncrStepSchema = z.tuple([z.string(), z.string(), z.number()]);

export const nonconformanceSchema = z.object({
  /** PK — NCR-YYMMDD-NNN. */
  no: z.string().min(1),
  date: z.string().default(''),
  src: z.enum(NCR_SOURCES),
  /** 발생 위치(라인·설비·검사번호). */
  loc: z.string().default(''),
  code: z.string().default(''),
  name: z.string().default(''),
  lot: z.string().default(''),
  /** 불량 유형명. */
  defect: z.string().default(''),
  /** 연계 불량코드(defectCodes 참조). */
  dcode: z.string().default(''),
  sev: z.enum(NCR_SEVERITY),
  /** 발생 수량. */
  qty: z.number().int().nonnegative().default(0),
  /** 격리 수량. */
  iso: z.number().int().nonnegative().default(0),
  /** 귀책(사내 귀책/협력사 귀책). */
  fault: z.string().default(''),
  /** 처리 구분(재작업·반품·특채·MRB 회부 등). */
  disp: z.string().default(''),
  status: z.enum(NCR_STATUS).default('발행'),
  pic: z.string().default(''),
  desc: z.string().default(''),
  steps: z.array(ncrStepSchema).default([]),
});

export type Nonconformance = z.infer<typeof nonconformanceSchema>;

/** 신규 발행용(번호·상태·단계는 repo가 채움). */
export const nonconformanceDraftSchema = nonconformanceSchema.partial().extend({
  src: z.enum(NCR_SOURCES),
  sev: z.enum(NCR_SEVERITY),
  name: z.string().min(1, '품목명은 필수입니다'),
  defect: z.string().min(1, '불량 유형은 필수입니다'),
});
export type NonconformanceDraft = z.infer<typeof nonconformanceDraftSchema>;
