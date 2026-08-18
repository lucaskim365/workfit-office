import { z } from 'zod';

export const WORK_PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const;
export const WORK_VISIBILITIES = ['PRIVATE', 'TEAM', 'COMPANY'] as const;

export const workProjectSchema = z.object({
  id: z.string().regex(/^PRJ-\d{4}$/, '프로젝트 ID 형식이 올바르지 않습니다.'),
  code: z.string().trim().min(1, '프로젝트 코드를 입력하세요.').max(30),
  name: z.string().trim().min(1, '프로젝트명을 입력하세요.').max(100),
  description: z.string().trim().max(2_000),
  ownerUserId: z.string().min(1),
  memberUserIds: z.array(z.string().min(1)).min(1),
  deptId: z.string().nullable(),
  visibility: z.enum(WORK_VISIBILITIES),
  status: z.enum(WORK_PROJECT_STATUSES),
  startAt: z.string().datetime().nullable(),
  dueAt: z.string().datetime().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '색상은 #RRGGBB 형식이어야 합니다.'),
  chatRoomId: z.string().nullable(),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedBy: z.string().min(1),
  updatedAt: z.string().datetime(),
}).superRefine((value, ctx) => {
  if (!value.memberUserIds.includes(value.ownerUserId)) {
    ctx.addIssue({ code: 'custom', path: ['memberUserIds'], message: '프로젝트 소유자는 참여자에 포함되어야 합니다.' });
  }
  if (new Set(value.memberUserIds).size !== value.memberUserIds.length) {
    ctx.addIssue({ code: 'custom', path: ['memberUserIds'], message: '프로젝트 참여자를 중복 지정할 수 없습니다.' });
  }
  if (value.startAt && value.dueAt && value.startAt > value.dueAt) {
    ctx.addIssue({ code: 'custom', path: ['dueAt'], message: '프로젝트 종료일은 시작일보다 빠를 수 없습니다.' });
  }
});

export type WorkProject = z.infer<typeof workProjectSchema>;
export type WorkProjectStatus = (typeof WORK_PROJECT_STATUSES)[number];
export type WorkVisibility = (typeof WORK_VISIBILITIES)[number];

export type WorkProjectDraft = Omit<WorkProject, 'id' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'>;

export const WORK_PROJECT_STATUS_LABELS: Record<WorkProjectStatus, string> = {
  PLANNING: '계획',
  ACTIVE: '진행',
  ON_HOLD: '보류',
  COMPLETED: '완료',
  ARCHIVED: '보관',
};
