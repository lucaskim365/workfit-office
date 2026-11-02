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
  /** 맨 위 가운데에 회사 로고(회사 정보 화면에 등록한 로고) — 공문처럼 상단 바를 끈 서식용 */
  showLogo: z.boolean().optional(),
  /** 쓸 로고(회사 로고·직인 목록 id) — 없으면 대표 로고 */
  logoId: z.string().max(64).optional(),
  /** 줄 키(address·tel… / site:사업장명)별로 서식에서 바꾼 이름 — 비우면 기본 이름 */
  labels: z.record(z.string().max(120), z.string().max(40)).optional(),
  /** 줄 순서(줄 키) — 목록에 없는 줄은 기본 순서로 뒤에 */
  order: z.array(z.string().max(120)).max(60).optional(),
  /** 한 줄에 놓을 개수(1~4) — 없으면 1 */
  columns: z.number().int().min(1).max(4).optional(),
  /** 열 수와 상관없이 혼자 한 줄을 차지하는 줄(줄 키) */
  fullRow: z.array(z.string().max(120)).max(60).optional(),
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
  /** 줄 키 — address·tel… 또는 site:사업장명 */
  key: string;
  item: LetterheadItem;
  label: string;
  value: string;
  /** 혼자 한 줄 전체 */
  full: boolean;
}

/** 서식 설정 목록의 한 줄 — 값이 비었거나 꺼져 있어도 후보로 보인다 */
export interface LetterheadEntry extends LetterheadLine {
  /** 바꾸지 않은 이름(회사 정보 화면의 이름) */
  defaultLabel: string;
  /** 서식에서 켰는지 */
  shown: boolean;
  /** 회사 주소와 같은 주소라 겹치지 않게 빼는 사업장 */
  duplicate: boolean;
}

/**
 * 회사 정보 칸의 모든 후보 줄 — 고른 순서대로. 사업장 주소는 사업장마다 한 줄(사업장명 + 주소).
 * 서식 편집기는 이 목록으로 켜기·이름·순서·한 줄 전체를 정하고, 문서는 letterheadLines 로 보인다.
 */
export function letterheadEntries(
  config: LetterheadConfig,
  company: LetterheadCompany | null | undefined,
  sites: LetterheadSite[] | null | undefined,
): LetterheadEntry[] {
  const companyAddress = config.items.includes('address') ? (company?.address ?? '').trim() : '';
  const make = (key: string, item: LetterheadItem, defaultLabel: string, value: string, shown: boolean, duplicate = false): LetterheadEntry => {
    const custom = config.labels?.[key]?.trim();
    return { key, item, defaultLabel, label: custom || defaultLabel, value: value.trim(), shown, duplicate, full: config.fullRow?.includes(key) ?? false };
  };
  const base = LETTERHEAD_ITEMS.flatMap((item): LetterheadEntry[] => {
    const itemOn = config.items.includes(item);
    if (item === 'labAddress') {
      return letterheadSiteOptions(sites).map((s) =>
        make(
          `site:${s.name}`,
          item,
          s.name,
          s.addr,
          itemOn && (!config.siteNames || config.siteNames.includes(s.name)),
          Boolean(companyAddress) && sameAddress(s.addr, companyAddress),
        ),
      );
    }
    return [make(item, item, LETTERHEAD_ITEM_LABEL[item], company?.[item] ?? '', itemOn)];
  });
  const rank = (key: string) => {
    const i = config.order?.indexOf(key) ?? -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  // 정렬은 안정적이라 순서 목록에 없는 줄은 기본 순서를 지킨다
  return [...base].sort((a, b) => rank(a.key) - rank(b.key));
}

/**
 * 문서에 보일 머리글 줄 — 켜져 있고 값이 있는 줄만. 회사 주소를 함께 보일 때 그와 같은 주소의 사업장(본사 등)은 뺀다.
 */
export function letterheadLines(
  config: LetterheadConfig,
  company: LetterheadCompany | null | undefined,
  sites: LetterheadSite[] | null | undefined,
): LetterheadLine[] {
  return letterheadEntries(config, company, sites)
    .filter((e) => e.shown && e.value && !e.duplicate)
    .map(({ key, item, label, value, full }) => ({ key, item, label, value, full }));
}

/** 직인 칸 문구 — 서식에 적은 문구가 기본값이고, 기안할 때 문서마다 고친 문구(값)가 있으면 그것 */
export function sealTextOf(field: { key: string; label: string }, values: Record<string, unknown> | null | undefined): string {
  const v = values?.[field.key];
  return typeof v === 'string' && v.trim() ? v : field.label;
}

/** 상신할 값에 직인 칸 문구를 채운다 — 고치지 않았으면 그 시점의 서식 문구. 직인 칸이 없으면 받은 값 그대로 */
export function withSealTexts<V>(
  fields: Array<{ key: string; label: string; type: string }> | null | undefined,
  values: Record<string, V | string>,
): Record<string, V | string> {
  const seals = (fields ?? []).filter((f) => f.type === '직인');
  if (seals.length === 0) return values;
  const out = { ...values };
  for (const f of seals) out[f.key] = sealTextOf(f, values);
  return out;
}
