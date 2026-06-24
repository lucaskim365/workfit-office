import { z } from 'zod';

/**
 * 생산 불출(Issue) 도메인 — 작업지시에 자재를 불출(키팅). header-line + 상태머신.
 * ([[데이터_모델_설계서.md]] issues)
 */
export const ISSUE_STATUS = ['준비중', '불출완료'] as const;
export type IssueStatus = (typeof ISSUE_STATUS)[number];

export const issueLineSchema = z.object({
  code: z.string().min(1), // 자재 품목코드(FK→items)
  name: z.string().default(''),
  qty: z.number().int().nonnegative(),
});
export type IssueLine = z.infer<typeof issueLineSchema>;

export const issueSchema = z.object({
  no: z.string().min(1), // 불출번호(PK) IS-YYMMDD-NN
  wo: z.string().default(''), // 작업지시(FK→workOrders)
  target: z.string().default(''), // 불출 대상(라인/작업장)
  kit: z.string().default(''),
  warehouse: z.string().default('A-Zone'),
  status: z.enum(ISSUE_STATUS).default('준비중'),
  materials: z.array(issueLineSchema).default([]),
});
export type Issue = z.infer<typeof issueSchema>;

/** 자재 종수(화면 표시용). */
export function materialKinds(i: Issue): number {
  return i.materials.length;
}
