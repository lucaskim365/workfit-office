import { z } from 'zod';

/**
 * 자재 요청 materialRequests. PK=wo. 라인 임베드.
 * 헤더(작업지시) + 라인(소요 자재 mats)을 함께 로드하므로 header-line 임베드 패턴.
 * ([[데이터_모델_설계서.md]] / [[비즈니스_로직_개발_전략.md]] 계층 구조)
 */

/** 소요 자재 라인 — 화면 Mat 인터페이스 필드 그대로. */
export const matSchema = z.object({
  code: z.string(),
  name: z.string(),
  req: z.number().nonnegative(),
  unit: z.string(),
  stock: z.number().nonnegative(),
  loc: z.string(),
});
export type Mat = z.infer<typeof matSchema>;

export const materialRequestSchema = z.object({
  wo: z.string().min(1), // 작업지시번호(PK)
  name: z.string(),
  line: z.string(),
  mats: z.array(matSchema).default([]),
});
export type MaterialRequest = z.infer<typeof materialRequestSchema>;
