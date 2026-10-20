import { createCrudBackend, DocumentExistsError } from '@/data/_backend/crudBackend';
import {
  assertTagNameAvailable,
  isFixedTagId,
  workPlanTagSchema,
  WorkPlanTagError,
  type WorkPlanTag,
  type WorkPlanTagDraft,
} from '@/domain/workPlan/tag';

function parseTag(input: unknown): WorkPlanTag {
  const parsed = workPlanTagSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw new WorkPlanTagError('INVALID_INPUT', parsed.error.issues[0]?.message || '입력값을 확인하세요.');
}

/** 문서 ID = `WorkPlanTag.id`(`WT-0001`). 고정 태그(회의·외근·출장)는 코드에 있어 여기에 저장하지 않는다. */
const backend = createCrudBackend<WorkPlanTag>({
  coll: 'workPlanTags',
  parse: (raw) => {
    const parsed = workPlanTagSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  idOf: (row) => row.id,
  seed: [],
});

const MAX_ID_ATTEMPTS = 5;

function nextId(rows: WorkPlanTag[], offset: number): string {
  const max = rows.reduce((v, r) => Math.max(v, Number(r.id.slice(-4)) || 0), 0);
  return `WT-${String(max + 1 + offset).padStart(4, '0')}`;
}

export const workPlanTagRepo = {
  /** 숨긴 태그까지 전부 — 관리 화면용. order 오름차순. 권한 판정은 화면에서 한다. */
  async list(): Promise<WorkPlanTag[]> {
    const rows = await backend.loadAll();
    return rows.map((r) => ({ ...r })).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  },

  async create(draft: WorkPlanTagDraft): Promise<WorkPlanTag> {
    const rows = await backend.loadAll();
    assertTagNameAvailable(rows, draft.name);
    for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
      const row = parseTag({ ...draft, id: nextId(rows, attempt) });
      try {
        await backend.insert(row);
        return { ...row };
      } catch (error) {
        if (!(error instanceof DocumentExistsError)) throw error;
      }
    }
    throw new WorkPlanTagError('INVALID_INPUT', '태그 번호를 발급하지 못했습니다. 잠시 후 다시 시도하세요.');
  },

  async update(id: string, draft: WorkPlanTagDraft): Promise<WorkPlanTag> {
    if (isFixedTagId(id)) throw new WorkPlanTagError('FIXED', '고정 태그는 바꿀 수 없습니다.');
    const rows = await backend.loadAll();
    const current = rows.find((r) => r.id === id);
    if (!current) throw new WorkPlanTagError('INVALID_INPUT', '태그를 찾을 수 없습니다.');
    // 숨김 상태로 두는 동안은 이름이 겹쳐도 상관없다. 보이는 상태로 쓸 때만 검사한다.
    if (!draft.hidden) assertTagNameAvailable(rows, draft.name, id);
    const updated = parseTag({ ...current, ...draft, id: current.id });
    await backend.save(updated);
    return { ...updated };
  },
};
