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
  // 키는 예전 이름(labAddress) 그대로 — 이미 저장된 서식 설정이 그대로 읽히게
  labAddress: '사업장 주소',
  tel: '대표전화',
  fax: '팩스',
  homepage: '홈페이지',
  email: '대표 이메일',
};

export const letterheadConfigSchema = z.object({
  items: z.array(z.enum(LETTERHEAD_ITEMS)).default([...LETTERHEAD_ITEMS]),
  /** 예전에 서식에서 직접 적던 연구소 주소 — 이제 쓰지 않는다(사업장 현황에서 가져옴). 저장된 값을 읽기 위해 둔다 */
  labAddress: z.string().max(200).default(''),
  /** 보일 사업장 이름 — 없으면 사용 중인 사업장 전부 */
  siteNames: z.array(z.string().max(100)).max(50).optional(),
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

/** 회사 정보 화면 '사업장 현황'의 한 줄 */
export interface LetterheadSite {
  name: string;
  addr: string;
  active: boolean;
}

/** 머리글에 고를 수 있는 사업장 — 사용 중이고 주소가 있는 것, 등록 순서대로 */
export function letterheadSiteOptions<S extends LetterheadSite>(sites: S[] | null | undefined): S[] {
  return (sites ?? []).filter((s) => s.active && s.addr.trim());
}

const sameAddress = (a: string, b: string) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '');

export interface LetterheadLine {
  key: string;
  item: LetterheadItem;
  label: string;
  value: string;
}

/**
 * 머리글 줄 — 값이 빈 항목은 뺀다. 사업장 주소는 사업장마다 한 줄(사업장명 + 주소)이고,
 * 회사 주소를 함께 보일 때 그와 같은 주소의 사업장(본사 등)은 겹치지 않게 뺀다.
 */
export function letterheadLines(
  config: LetterheadConfig,
  company: LetterheadCompany | null | undefined,
  sites: LetterheadSite[] | null | undefined,
): LetterheadLine[] {
  const companyAddress = config.items.includes('address') ? (company?.address ?? '').trim() : '';
  return LETTERHEAD_ITEMS.filter((item) => config.items.includes(item)).flatMap((item): LetterheadLine[] => {
    if (item === 'labAddress') {
      return letterheadSiteOptions(sites)
        .filter((s) => !config.siteNames || config.siteNames.includes(s.name))
        .filter((s) => !companyAddress || !sameAddress(s.addr, companyAddress))
        .map((s) => ({ key: `site:${s.name}`, item, label: s.name, value: s.addr.trim() }));
    }
    const value = (company?.[item] ?? '').trim();
    return value ? [{ key: item, item, label: LETTERHEAD_ITEM_LABEL[item], value }] : [];
  });
}
