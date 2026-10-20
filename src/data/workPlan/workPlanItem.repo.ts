import { createCrudBackend, DocumentExistsError } from '@/data/_backend/crudBackend';
import { isValidCalendarDate } from '@/domain/calendarEvent/calendarDate';
import { workPlanItemSchema, type WorkPlanItem, type WorkPlanItemDraft } from '@/domain/workPlan/item';

export interface WorkPlanItemActor {
  userId: string;
  active: boolean;
}

export class WorkPlanItemError extends Error {
  constructor(public readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_RANGE' | 'CONFLICT', message: string) {
    super(message);
    this.name = 'WorkPlanItemError';
  }
}

function parseItem(input: unknown): WorkPlanItem {
  const parsed = workPlanItemSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw new WorkPlanItemError('INVALID_INPUT', parsed.error.issues[0]?.message || '입력값을 확인하세요.');
}

/** 문서 ID = `WorkPlanItem.id`(`WI-20261021-0001`, 날짜는 항목 날짜). 기존 workPlans와 별개 컬렉션이다. */
const backend = createCrudBackend<WorkPlanItem>({
  coll: 'workPlanItems',
  parse: (raw) => {
    const parsed = workPlanItemSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  idOf: (row) => row.id,
  seed: [],
});

const MAX_ID_ATTEMPTS = 5;

function requireActive(actor: WorkPlanItemActor): void {
  if (!actor.active) throw new WorkPlanItemError('FORBIDDEN', '사용 중인 계정만 업무계획을 변경할 수 있습니다.');
}

/** 고치고 지우는 건 본인 항목만. */
function findOwned(rows: WorkPlanItem[], actor: WorkPlanItemActor, id: string): WorkPlanItem {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new WorkPlanItemError('NOT_FOUND', '업무계획 항목을 찾을 수 없습니다.');
  if (row.ownerUserId !== actor.userId) throw new WorkPlanItemError('FORBIDDEN', '본인 업무계획만 고칠 수 있습니다.');
  return row;
}

function nextId(rows: WorkPlanItem[], date: string, offset: number): string {
  const prefix = `WI-${date.replaceAll('-', '')}-`;
  const max = rows.filter((r) => r.id.startsWith(prefix)).reduce((v, r) => Math.max(v, Number(r.id.slice(-4)) || 0), 0);
  return `${prefix}${String(max + 1 + offset).padStart(4, '0')}`;
}

const sortItems = (rows: WorkPlanItem[]) =>
  rows.sort((a, b) => a.date.localeCompare(b.date) || Number(b.allDay) - Number(a.allDay) || (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.id.localeCompare(b.id));

export const workPlanItemRepo = {
  /** 전사 공개 — 날짜 범위 안 전원의 항목. */
  async listRange(filter: { from: string; to: string }): Promise<WorkPlanItem[]> {
    if (!isValidCalendarDate(filter.from) || !isValidCalendarDate(filter.to)) throw new WorkPlanItemError('INVALID_RANGE', '조회 기간이 올바르지 않습니다.');
    if (filter.from > filter.to) throw new WorkPlanItemError('INVALID_RANGE', '조회 종료일은 시작일보다 빠를 수 없습니다.');
    const rows = await backend.loadAll();
    return sortItems(rows.filter((r) => r.date >= filter.from && r.date <= filter.to).map((r) => ({ ...r })));
  },

  /** 본인 칸에만 만든다. 남의 칸(회의 초대 등)은 이 함수가 아니라 일정 쪽이 맡는다. */
  async create(actor: WorkPlanItemActor, ownerUserId: string, draft: WorkPlanItemDraft): Promise<WorkPlanItem> {
    requireActive(actor);
    if (ownerUserId !== actor.userId) throw new WorkPlanItemError('FORBIDDEN', '본인 칸에만 계획을 만들 수 있습니다.');
    const rows = await backend.loadAll();
    const now = new Date().toISOString();
    for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
      const row = parseItem({ ...draft, id: nextId(rows, draft.date, attempt), ownerUserId, createdBy: actor.userId, createdAt: now, updatedAt: now });
      try {
        await backend.insert(row);
        return { ...row };
      } catch (error) {
        if (!(error instanceof DocumentExistsError)) throw error;
      }
    }
    throw new WorkPlanItemError('CONFLICT', '항목 번호를 발급하지 못했습니다. 잠시 후 다시 시도하세요.');
  },

  async update(actor: WorkPlanItemActor, id: string, draft: WorkPlanItemDraft): Promise<WorkPlanItem> {
    requireActive(actor);
    const current = findOwned(await backend.loadAll(), actor, id);
    const updated = parseItem({ ...current, ...draft, id: current.id, ownerUserId: current.ownerUserId, createdBy: current.createdBy, createdAt: current.createdAt, updatedAt: new Date().toISOString() });
    await backend.save(updated);
    return { ...updated };
  },

  async remove(actor: WorkPlanItemActor, id: string): Promise<WorkPlanItem> {
    requireActive(actor);
    const current = findOwned(await backend.loadAll(), actor, id);
    await backend.remove(id);
    return { ...current };
  },
};
