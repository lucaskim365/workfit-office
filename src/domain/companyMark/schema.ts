import { z } from 'zod';

/**
 * 회사 로고·직인 목록 companyMarks — 회사 정보 화면에서 여러 개 등록하고, 대표 하나를 고른다.
 * 대표는 회사 기본정보(companyInfo.logoUrl·sealUrl)에 그대로 넣어 둬서 기존 화면은 지금처럼 동작한다.
 * 결재서식은 칸마다 이 목록의 id 를 골라 쓰고, 고르지 않으면 대표를 쓴다.
 */
export const COMPANY_MARK_KINDS = ['logo', 'seal'] as const;
export type CompanyMarkKind = (typeof COMPANY_MARK_KINDS)[number];

export const companyMarkSchema = z.object({
  id: z.string().regex(/^MK-[0-9a-z]{4,32}$/),
  kind: z.enum(COMPANY_MARK_KINDS),
  name: z.string().trim().min(1, '이름을 입력하세요').max(40),
  url: z.string().min(1),
  path: z.string().default(''),
  order: z.number().int().default(0),
});
export type CompanyMark = z.infer<typeof companyMarkSchema>;

/** 같은 종류만, 등록 순서대로 */
export function marksOf(marks: CompanyMark[] | null | undefined, kind: CompanyMarkKind): CompanyMark[] {
  return (marks ?? []).filter((m) => m.kind === kind).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko'));
}

/** 서식이 고른 그림 주소 — 고른 것이 목록에 있으면 그것, 없거나(지워짐) 안 골랐으면 대표 */
export function markUrlOf(
  marks: CompanyMark[] | null | undefined,
  kind: CompanyMarkKind,
  markId: string | null | undefined,
  representativeUrl: string | null | undefined,
): string {
  const picked = markId ? (marks ?? []).find((m) => m.id === markId && m.kind === kind) : undefined;
  return picked?.url ?? representativeUrl ?? '';
}

/** 새 id — 시각 기반(겹치지 않게 임의 글자 덧붙임) */
export function newMarkId(now = Date.now(), rand = Math.random()): string {
  return `MK-${now.toString(36)}${Math.floor(rand * 36 ** 4).toString(36).padStart(4, '0')}`;
}
