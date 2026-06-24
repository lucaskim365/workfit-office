import { z } from 'zod';

/**
 * 8D 보고서(8D Report) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 8D 문제해결 보고서(팀 구성~완료 8단계). 상태머신 작성중→검토→발행→고객승인. 채번 8D-YYMMDD-NNN.
 *
 * 고객 클레임·부적합(NCR)에서 파생되는 정형 시정조치 보고서.
 */
export const D8_STATUS = ['작성중', '검토', '발행', '고객승인'] as const;

export const d8ReportSchema = z.object({
  /** PK — 8D-YYMMDD-NNN. */
  no: z.string().min(1),
  /** 연계 고객 클레임(voc) 번호. 없으면 '—'. */
  voc: z.string().default('—'),
  /** 연계 부적합(ncr) 번호. 없으면 '—'. */
  ncr: z.string().default('—'),
  title: z.string().default(''),
  cust: z.string().default(''),
  owner: z.string().default(''),
  date: z.string().default(''),
  status: z.enum(D8_STATUS).default('작성중'),
  /** 진척 단계(0~8). 완료한 단계 수. */
  step: z.number().int().min(0).max(8).default(0),
  /** 8개 단계 본문(D1~D8). 미작성 단계는 빈 문자열. */
  body: z.array(z.string()).default([]),
});

export type D8Report = z.infer<typeof d8ReportSchema>;

/** 신규 발행용(번호·상태는 repo가 채움). */
export const d8ReportDraftSchema = d8ReportSchema.partial().extend({
  title: z.string().min(1, '제목은 필수입니다'),
  cust: z.string().min(1, '고객은 필수입니다'),
});
export type D8ReportDraft = z.infer<typeof d8ReportDraftSchema>;
