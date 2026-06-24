import { z } from 'zod';

/**
 * 시정·예방조치(CAPA) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설계서 2.5 `capaActions`. 상태머신 진행→검증→종결(지연 분기). 채번 CAPA-YYMMDD-NNN.
 *
 * NCR·클레임·내부감사 등에서 도출된 부적합의 근본원인 제거(시정)·재발방지(예방) 8D 조치 보고서.
 */
export const CAPA_TYPES = ['시정', '예방'] as const;
export const CAPA_STATUS = ['진행', '지연', '검증', '종결'] as const;

/** 조치 항목 [구분(시정|예방), 내용, 담당, 기한, 상태]. */
export const capaActionSchema = z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()]);

export const capaSchema = z.object({
  /** PK — CAPA-YYMMDD-NNN. */
  no: z.string().min(1),
  /** 조치 구분(시정|예방). */
  type: z.enum(CAPA_TYPES),
  /** 발생원(NCR·고객 클레임·내부 감사·반복 불량 등). */
  src: z.string().default(''),
  /** 연계 문서 번호(NCR/감사/불량코드 참조). */
  ref: z.string().default(''),
  title: z.string().default(''),
  owner: z.string().default(''),
  team: z.string().default(''),
  /** 완료 기한. */
  due: z.string().default(''),
  status: z.enum(CAPA_STATUS).default('진행'),
  /** 8D 진행 단계(0~8). */
  step: z.number().int().nonnegative().default(0),
  /** 문제 정의(D2). */
  problem: z.string().default(''),
  /** 근본 원인(D4). */
  root: z.string().default(''),
  /** 조치 항목(D5~D7). */
  actions: z.array(capaActionSchema).default([]),
  /** 효과성 검증(D8) 결과. */
  verify: z.string().default(''),
});

export type Capa = z.infer<typeof capaSchema>;

/** 신규 등록용(번호·상태·단계는 repo가 채움). */
export const capaDraftSchema = capaSchema.partial().extend({
  type: z.enum(CAPA_TYPES),
  title: z.string().min(1, '제목은 필수입니다'),
  owner: z.string().min(1, '담당자는 필수입니다'),
});
export type CapaDraft = z.infer<typeof capaDraftSchema>;
