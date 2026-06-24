import { z } from 'zod';

/**
 * 고객 클레임(VOC) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 고객 접수 클레임의 접수~원인분석~회신~종결 처리 이력. 채번 VOC-YYMMDD-NNN.
 *
 * 상태머신 접수→조사중→회신→종결(선형). NCR 슬라이스와 동일한 패턴.
 */
export const VOC_TYPES = ['품질', '납기', '포장', '수량', '서비스'] as const;
export const VOC_STATUS = ['접수', '조사중', '회신', '종결'] as const;

/** 처리 단계 [라벨, 일시, 완료(1)|미완료(0)]. */
export const vocStepSchema = z.tuple([z.string(), z.string(), z.number()]);

/** 연계 처리 문서(NCR·8D·MRB). 미연계는 '—'. */
export const vocLinkSchema = z.object({
  ncr: z.string().default('—'),
  d8: z.string().default('—'),
  mrb: z.string().default('—'),
});

export const vocSchema = z.object({
  /** PK — VOC-YYMMDD-NNN. */
  no: z.string().min(1),
  date: z.string().default(''),
  /** 고객명. */
  cust: z.string().default(''),
  /** 접수 담당자(고객측 연락처). */
  contact: z.string().default(''),
  /** 대상 제품명. */
  prod: z.string().default(''),
  code: z.string().default(''),
  lot: z.string().default(''),
  type: z.enum(VOC_TYPES),
  sev: z.string().default(''),
  /** 접수 경로(전화·이메일·포털·방문 등). */
  channel: z.string().default(''),
  /** 대상 수량. */
  qty: z.number().int().nonnegative().default(0),
  /** 회신기한(D-Day·D-1·지연·완료 등). */
  due: z.string().default(''),
  status: z.enum(VOC_STATUS).default('접수'),
  pic: z.string().default(''),
  /** 클레임 내용. */
  content: z.string().default(''),
  /** 고객 요구사항. */
  req: z.string().default(''),
  link: vocLinkSchema.default({ ncr: '—', d8: '—', mrb: '—' }),
  steps: z.array(vocStepSchema).default([]),
});

export type Voc = z.infer<typeof vocSchema>;

/** 신규 접수용(번호·상태·단계는 repo가 채움). */
export const vocDraftSchema = vocSchema.partial().extend({
  type: z.enum(VOC_TYPES),
  cust: z.string().min(1, '고객명은 필수입니다'),
  prod: z.string().min(1, '대상 제품은 필수입니다'),
});
export type VocDraft = z.infer<typeof vocDraftSchema>;
