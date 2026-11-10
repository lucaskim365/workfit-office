import { createCrudBackend } from '@/data/_backend/crudBackend';
import {
  scheduleChangeSchema,
  validateScheduleChange,
  type ScheduleChange,
  type ScheduleChangeInput,
} from '@/domain/scheduleChange/schema';
import type { StandardScheduleInfo } from '@/domain/approvalDoc/scheduleEngine';

export interface ScheduleChangeActor {
  userId: string;
  name: string;
  active: boolean;
  isAdmin?: boolean;
}

export class ScheduleChangeError extends Error {
  constructor(public readonly code: 'FORBIDDEN' | 'INVALID_INPUT', message: string) {
    super(message);
    this.name = 'ScheduleChangeError';
  }
}

/** 결재 완료 외근·출장 일정 변경 기록 — 결재 문서(approvalDocs)와 별개 컬렉션. 기록은 더하기만 한다. */
const backend = createCrudBackend<ScheduleChange>({
  coll: 'scheduleChanges',
  parse: (raw) => {
    const parsed = scheduleChangeSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  idOf: (row) => row.id,
  seed: [],
});

const newId = () => `SC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** 바꿀 수 있는가 — 결재 완료 외근·출장, 기안자 본인 또는 관리자 */
export function canChangeSchedule(s: Pick<StandardScheduleInfo, 'category' | 'drafterId'>, actor: Pick<ScheduleChangeActor, 'userId' | 'active' | 'isAdmin'>): boolean {
  return s.category !== 'LEAVE' && actor.active && (s.drafterId === actor.userId || Boolean(actor.isAdmin));
}

export const scheduleChangeRepo = {
  /** 전부 — 일정·근태가 함께 쓴다 */
  async listAll(): Promise<ScheduleChange[]> {
    return (await backend.loadAll()).map((r) => ({ ...r }));
  },

  /** 새 일정 기록. `current` = 지금 보이는 일정(이미 바뀐 적이 있으면 바뀐 일정) */
  async create(actor: ScheduleChangeActor, current: StandardScheduleInfo, input: ScheduleChangeInput): Promise<ScheduleChange> {
    if (!canChangeSchedule(current, actor)) throw new ScheduleChangeError('FORBIDDEN', '기안자 본인이나 관리자만 일정을 바꿀 수 있습니다.');
    const invalid = validateScheduleChange(input);
    if (invalid) throw new ScheduleChangeError('INVALID_INPUT', invalid);
    const parsed = scheduleChangeSchema.safeParse({
      id: newId(),
      docId: current.docId,
      startDate: input.startDate,
      endDate: input.endDate,
      startTime: input.allDay ? null : input.startTime,
      endTime: input.allDay ? null : input.endTime,
      prevStartDate: current.startDate,
      prevEndDate: current.endDate,
      prevStartTime: current.startTime ?? null,
      prevEndTime: current.endTime ?? null,
      reason: input.reason.trim(),
      changedBy: actor.userId,
      changedByName: actor.name,
      createdAt: new Date().toISOString(),
    });
    if (!parsed.success) throw new ScheduleChangeError('INVALID_INPUT', parsed.error.issues[0]?.message || '입력값을 확인하세요.');
    await backend.insert(parsed.data);
    return { ...parsed.data };
  },
};
