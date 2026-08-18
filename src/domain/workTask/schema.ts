import { z } from 'zod';

export const WORK_TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

export const workTaskSchema = z.object({
  id: z.string().regex(/^TASK-\d{8}-\d{4}$/, 'WBS 작업 ID 형식이 올바르지 않습니다.'),
  projectId: z.string().regex(/^PRJ-\d{4}$/, '프로젝트 ID 형식이 올바르지 않습니다.'),
  phaseId: z.string().regex(/^PHASE-\d{4}$/, 'WBS 단계 ID 형식이 올바르지 않습니다.'),
  title: z.string().trim().min(1, '작업명을 입력하세요.').max(150),
  description: z.string().trim().max(2_000),
  assigneeUserId: z.string().min(1, '담당자를 선택하세요.'),
  startAt: z.string().datetime().nullable(),
  dueAt: z.string().datetime().nullable(),
  status: z.enum(WORK_TASK_STATUSES),
  progress: z.number().int().min(0).max(100),
  sortOrder: z.number().int().min(0),
  completedAt: z.string().datetime().nullable(),
  version: z.number().int().min(1),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedBy: z.string().min(1),
  updatedAt: z.string().datetime(),
}).superRefine((value, ctx) => {
  if (value.startAt && value.dueAt && value.startAt > value.dueAt) {
    ctx.addIssue({ code: 'custom', path: ['dueAt'], message: '작업 마감일은 시작일보다 빠를 수 없습니다.' });
  }
  if (value.status === 'TODO' && value.progress !== 0) {
    ctx.addIssue({ code: 'custom', path: ['progress'], message: '할 일 상태의 진척률은 0%여야 합니다.' });
  }
  if (value.status === 'IN_PROGRESS' && (value.progress < 1 || value.progress > 99)) {
    ctx.addIssue({ code: 'custom', path: ['progress'], message: '진행 중 상태의 진척률은 1~99%여야 합니다.' });
  }
  if (value.status === 'DONE' && value.progress !== 100) {
    ctx.addIssue({ code: 'custom', path: ['progress'], message: '완료 상태의 진척률은 100%여야 합니다.' });
  }
  if (value.status === 'DONE' && !value.completedAt) {
    ctx.addIssue({ code: 'custom', path: ['completedAt'], message: '완료 작업에는 완료일시가 필요합니다.' });
  }
  if (value.status !== 'DONE' && value.completedAt) {
    ctx.addIssue({ code: 'custom', path: ['completedAt'], message: '미완료 작업에는 완료일시를 둘 수 없습니다.' });
  }
});

export type WorkTask = z.infer<typeof workTaskSchema>;
export type WorkTaskStatus = (typeof WORK_TASK_STATUSES)[number];
export type WorkTaskDraft = Omit<WorkTask,
  'id' | 'sortOrder' | 'completedAt' | 'version' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'
>;

export const WORK_TASK_STATUS_LABELS: Record<WorkTaskStatus, string> = {
  TODO: '할 일',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
};
