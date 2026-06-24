import { z } from 'zod';

/**
 * 외주 자재불출 subconIssues. PK=no. 라인 임베드.
 * 외주 지시(header) + 지급 자재(mats)를 함께 로드하므로 라인 임베드(header-line 정본 패턴).
 * ([[데이터_모델_설계서.md]] subconIssues)
 */
export const SUBCON_MAT_TYPE = ['무상', '유상'] as const;

export const subconMatSchema = z.object({
  code: z.string(),
  name: z.string(),
  /** 무상(공정 지급) vs 유상(매입 지급). */
  type: z.enum(SUBCON_MAT_TYPE),
  /** 천단위 콤마 포함 문자열(화면 표기 그대로). */
  qty: z.string(),
  unit: z.string(),
  /** 유상 단가. 무상이면 0. */
  price: z.number().nonnegative().default(0),
});
export type SubconMat = z.infer<typeof subconMatSchema>;

export const subconIssueSchema = z.object({
  no: z.string().min(1), // 외주 지시번호(PK)
  vendor: z.string().min(1),
  mats: z.array(subconMatSchema).default([]),
});
export type SubconIssue = z.infer<typeof subconIssueSchema>;
