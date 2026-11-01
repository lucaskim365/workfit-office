import { z } from 'zod';

/*
  문서 머리 항목 숨김 — 서식(hiddenHeaderItems)마다 문서 종이에서 늘 숨길 항목을 고른다(작성·결재 중·완료·인쇄 모두).
  기존 '대외 문서'(hideDocInfoOnComplete: 결재 완료 후 한꺼번에 숨김)와 칸별 '대외 문서에서 숨김'은 그대로 두고,
  보일지 = 목록에서 끄지 않았고 AND 대외 문서 조건에 걸리지 않을 때.
*/

export const HEADER_ITEMS = [
  'topBar',
  'docTitle',
  'docNo',
  'drafterDept',
  'drafter',
  'draftDate',
  'completedDate',
  'preservation',
  'visibility',
  'closing',
] as const;
export type HeaderItem = (typeof HEADER_ITEMS)[number];

export const HEADER_ITEM_LABEL: Record<HeaderItem, string> = {
  topBar: '상단 바(로고)',
  docTitle: '문서 이름(큰 제목)',
  docNo: '문서번호',
  drafterDept: '기안부서',
  drafter: '기안자',
  draftDate: '기안일',
  completedDate: '결재 완료일',
  preservation: '보존연한',
  visibility: '공개범위',
  closing: '맺음말·기안일·기안자 서명',
};

export function headerShown(form: { hiddenHeaderItems?: string[] | null } | null | undefined, item: HeaderItem): boolean {
  return !(form?.hiddenHeaderItems ?? []).includes(item);
}

/** '문서제목' 칸이 있으면 머리의 제목 줄 대신 그 자리에서 제목을 입력·표시한다 */
export function titleFieldOf<F extends { type: string; key: string }>(fields: F[] | null | undefined): F | undefined {
  return (fields ?? []).find((f) => f.type === '문서제목');
}

/** 회사 정보 머리글 항목 */
export const LETTERHEAD_ITEMS = ['address', 'labAddress', 'tel', 'fax', 'homepage', 'email'] as const;
export type LetterheadItem = (typeof LETTERHEAD_ITEMS)[number];
export const LETTERHEAD_ITEM_LABEL: Record<LetterheadItem, string> = {
  address: '회사 주소',
  labAddress: '연구소 주소',
  tel: '대표전화',
  fax: '팩스',
  homepage: '홈페이지',
  email: '대표 이메일',
};

export const letterheadConfigSchema = z.object({
  items: z.array(z.enum(LETTERHEAD_ITEMS)).default([...LETTERHEAD_ITEMS]),
  /** 연구소 주소 — 회사 정보 화면에 없어 서식에서 직접 입력 */
  labAddress: z.string().max(200).default(''),
});
export type LetterheadConfig = z.infer<typeof letterheadConfigSchema>;
export const DEFAULT_LETTERHEAD: LetterheadConfig = { items: [...LETTERHEAD_ITEMS], labAddress: '' };

export interface LetterheadCompany {
  address?: string;
  tel?: string;
  fax?: string;
  homepage?: string;
  email?: string;
}

/** 머리글 줄 — 값이 빈 항목은 뺀다 */
export function letterheadLines(config: LetterheadConfig, company: LetterheadCompany | null | undefined): Array<{ item: LetterheadItem; label: string; value: string }> {
  const valueOf = (item: LetterheadItem) => (item === 'labAddress' ? config.labAddress : company?.[item] ?? '').trim();
  return LETTERHEAD_ITEMS.filter((item) => config.items.includes(item))
    .map((item) => ({ item, label: LETTERHEAD_ITEM_LABEL[item], value: valueOf(item) }))
    .filter((line) => line.value);
}
