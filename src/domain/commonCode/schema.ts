import { z } from 'zod';

/**
 * 공통코드(CommonCode) 도메인 스키마 — 모든 모듈 enum 의 원천.
 * 설계서 기준 flat 컬렉션: 문서 1건 = 코드값 1개. PK = groupCode + code.
 * ([[데이터_모델_설계서.md]] commonCodes)
 */
export const commonCodeSchema = z.object({
  groupCode: z.string().min(1, '그룹코드는 필수입니다'),
  groupName: z.string().default(''),
  code: z.string().min(1, '코드는 필수입니다'),
  name: z.string().min(1, '코드명은 필수입니다'),
  order: z.number().int().nonnegative().default(0),
  use: z.boolean().default(true),
  regBy: z.string().default('관리자'),
});

export type CommonCode = z.infer<typeof commonCodeSchema>;

/** 그룹 뷰(화면 표시용) — flat 목록에서 도출. */
export interface CodeGroup {
  code: string;
  name: string;
  codes: CommonCode[];
}

/** flat 코드 목록 → 그룹 뷰. 그룹 등장 순서 유지, 그룹 내 order 오름차순. */
export function groupCommonCodes(list: CommonCode[]): CodeGroup[] {
  const map = new Map<string, CodeGroup>();
  for (const c of list) {
    let g = map.get(c.groupCode);
    if (!g) {
      g = { code: c.groupCode, name: c.groupName, codes: [] };
      map.set(c.groupCode, g);
    }
    g.codes.push(c);
  }
  for (const g of map.values()) g.codes.sort((a, b) => a.order - b.order);
  return [...map.values()];
}
