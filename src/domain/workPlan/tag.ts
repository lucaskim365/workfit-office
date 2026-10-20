import { z } from 'zod';

/** 고정 태그 — 회의·외근·출장은 이름·색을 바꾸거나 지울 수 없다. */
export const FIXED_WORK_PLAN_TAGS = [
  { id: 'MEETING', name: '회의', colorId: 'purple' },
  { id: 'OUTSIDE', name: '외근', colorId: 'amber' },
  { id: 'TRIP', name: '출장', colorId: 'indigo' },
] as const;

export type FixedTagId = (typeof FIXED_WORK_PLAN_TAGS)[number]['id'];

export function isFixedTagId(id: string): id is FixedTagId {
  return FIXED_WORK_PLAN_TAGS.some((tag) => tag.id === id);
}

export const workPlanTagSchema = z.object({
  id: z.string().regex(/^WT-\d{4}$/, '태그 ID 형식이 올바르지 않습니다.'),
  name: z.string().trim().min(1, '태그 이름을 입력하세요.').max(10, '태그 이름은 10자까지입니다.'),
  colorId: z.string().min(1).max(32),
  order: z.number().int(),
  hidden: z.boolean(),
});

export type WorkPlanTag = z.infer<typeof workPlanTagSchema>;
export type WorkPlanTagDraft = Pick<WorkPlanTag, 'name' | 'colorId' | 'order' | 'hidden'>;

/** 처음 한 번 깔아 주는 일반 태그. */
export const DEFAULT_GENERAL_TAGS: ReadonlyArray<{ name: string; colorId: string }> = [
  { name: '업무', colorId: 'blue' },
  { name: '보고', colorId: 'teal' },
  { name: '교육', colorId: 'emerald' },
  { name: '마감', colorId: 'rose' },
  { name: '집중', colorId: 'pink' },
];

export class WorkPlanTagError extends Error {
  constructor(public readonly code: 'DUPLICATE' | 'FIXED' | 'INVALID_INPUT', message: string) {
    super(message);
    this.name = 'WorkPlanTagError';
  }
}

const normalize = (name: string) => name.trim().toLowerCase();

/** 이름 중복 검사 — 숨기지 않은 태그와 고정 태그 이름만 막는다. 숨긴 태그 이름은 다시 쓸 수 있다. */
export function assertTagNameAvailable(tags: WorkPlanTag[], name: string, excludeId?: string): void {
  const target = normalize(name);
  if (!target) throw new WorkPlanTagError('INVALID_INPUT', '태그 이름을 입력하세요.');
  if (FIXED_WORK_PLAN_TAGS.some((tag) => normalize(tag.name) === target)) {
    throw new WorkPlanTagError('DUPLICATE', '고정 태그와 같은 이름은 쓸 수 없습니다.');
  }
  if (tags.some((tag) => !tag.hidden && tag.id !== excludeId && normalize(tag.name) === target)) {
    throw new WorkPlanTagError('DUPLICATE', '이미 같은 이름의 태그가 있습니다.');
  }
}

/** 항목의 tagId를 보여줄 이름·색으로 푼다. 숨긴 태그도 풀리고, 못 찾으면 기타(slate). */
export function resolveTag(
  tags: WorkPlanTag[],
  tagId: string,
): { id: string; name: string; colorId: string; fixed: boolean; unknown: boolean } {
  const fixed = FIXED_WORK_PLAN_TAGS.find((tag) => tag.id === tagId);
  if (fixed) return { id: fixed.id, name: fixed.name, colorId: fixed.colorId, fixed: true, unknown: false };
  const general = tags.find((tag) => tag.id === tagId);
  if (general) return { id: general.id, name: general.name, colorId: general.colorId, fixed: false, unknown: false };
  return { id: tagId, name: '기타', colorId: 'slate', fixed: false, unknown: true };
}

/** 항목 작성 때 고를 수 있는 일반 태그 — 숨김 제외, order 오름차순, 같으면 이름순. */
export function selectableGeneralTags(tags: WorkPlanTag[]): WorkPlanTag[] {
  return tags
    .filter((tag) => !tag.hidden)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko'));
}
