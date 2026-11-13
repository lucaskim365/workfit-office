import { z } from 'zod';

/**
 * 기업분류(시스템 기준정보, 관리자 콘솔)·사업구분(업무 기준정보, 사업관리).
 * 둘 다 지우지 않고 use=false. 프로젝트와의 연결은 다음 단계(설계 §6.4).
 */
const audit = {
  createdBy: z.string().default(''),
  createdAt: z.string().default(''),
  updatedBy: z.string().default(''),
  updatedAt: z.string().default(''),
};

/** 기업분류 — 프로젝트에서 기업이 맡는 자리(도입기업·매입기업…). singlePerProject: 프로젝트당 한 곳만. */
export const companyClassSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  singlePerProject: z.boolean().default(false),
  order: z.number().int().default(0),
  use: z.boolean().default(true),
  note: z.string().default(''),
  ...audit,
});
export type CompanyClass = z.infer<typeof companyClassSchema>;

/** 사업구분 — 정부사업 종류(부처협업형·제조AI…). */
export const bizCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  order: z.number().int().default(0),
  use: z.boolean().default(true),
  note: z.string().default(''),
  ...audit,
});
export type BizCategory = z.infer<typeof bizCategorySchema>;

export const INITIAL_COMPANY_CLASSES: ReadonlyArray<{ id: string; name: string; singlePerProject: boolean; order: number }> = [
  { id: 'CCL-INTRO', name: '도입기업', singlePerProject: true, order: 10 },
  { id: 'CCL-BUY', name: '매입기업', singlePerProject: false, order: 20 },
];

const rid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const newCompanyClassId = () => rid('CCL');
export const newBizCategoryId = () => rid('BCT');

interface MasterLike { id: string; name: string; use: boolean; order: number }

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** 이름 검사 — 비었거나 같은 이름(공백·대소문자 무시, 사용 안 함 포함)이면 오류. */
export function validateMasterName(name: string, all: MasterLike[], label: string, excludeId?: string): string[] {
  if (!name.trim()) return [`${label} 이름을 입력하세요.`];
  const dup = all.find((r) => r.id !== excludeId && norm(r.name) === norm(name));
  if (!dup) return [];
  return [dup.use ? `이미 있는 ${label}입니다(${dup.name}).` : `이미 있는 ${label}입니다(${dup.name}, 사용 안 함). 그 항목을 다시 사용으로 바꾸세요.`];
}

/** 사용 중 먼저, 순서, 이름. */
export function sortMasters<T extends MasterLike>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Number(b.use) - Number(a.use) || a.order - b.order || a.name.localeCompare(b.name, 'ko'));
}

export function nextOrder(rows: MasterLike[]): number {
  return rows.reduce((m, r) => Math.max(m, r.order), 0) + 10;
}
