import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkProject } from '@/domain/workProject/schema';
import type { WorkPhase } from '@/domain/workPhase/schema';
import type { WorkTask, WorkTaskDraft, WorkTaskStatus } from './schema';

export type WbsDomainErrorCode =
  | 'FORBIDDEN'
  | 'INVALID_PROJECT'
  | 'INVALID_PHASE'
  | 'INVALID_ASSIGNEE'
  | 'INVALID_PROGRESS'
  | 'VERSION_CONFLICT';

export class WbsDomainError extends Error {
  constructor(public readonly code: WbsDomainErrorCode, message: string) {
    super(message);
    this.name = 'WbsDomainError';
  }
}

export function isWbsProjectMutable(project: WorkProject): boolean {
  return project.status !== 'COMPLETED' && project.status !== 'ARCHIVED';
}

export function canManageWbsPhases(actor: ProjectAccessContext, project: WorkProject): boolean {
  return actor.active && isWbsProjectMutable(project) && project.ownerUserId === actor.userId;
}

export function canCreateWbsTask(actor: ProjectAccessContext, project: WorkProject): boolean {
  return actor.active
    && isWbsProjectMutable(project)
    && project.memberUserIds.includes(actor.userId);
}

export function canEditWbsTask(
  actor: ProjectAccessContext,
  project: WorkProject,
  task: WorkTask,
): boolean {
  return actor.active
    && isWbsProjectMutable(project)
    && (project.ownerUserId === actor.userId || task.createdBy === actor.userId);
}

export function canUpdateWbsTaskProgress(
  actor: ProjectAccessContext,
  project: WorkProject,
  task: WorkTask,
): boolean {
  return actor.active
    && isWbsProjectMutable(project)
    && (project.ownerUserId === actor.userId
      || task.createdBy === actor.userId
      || task.assigneeUserId === actor.userId);
}

export function assertTaskReferences(
  project: WorkProject,
  phase: WorkPhase | null,
  draft: WorkTaskDraft,
): void {
  if (draft.projectId !== project.id) {
    throw new WbsDomainError('INVALID_PROJECT', '작업의 프로젝트가 일치하지 않습니다.');
  }
  if (!phase || phase.projectId !== project.id || draft.phaseId !== phase.id) {
    throw new WbsDomainError('INVALID_PHASE', '현재 프로젝트의 WBS 단계를 선택하세요.');
  }
  if (!project.memberUserIds.includes(draft.assigneeUserId)) {
    throw new WbsDomainError('INVALID_ASSIGNEE', '프로젝트 참여자만 작업 담당자로 지정할 수 있습니다.');
  }
}

export function statusForProgress(progress: number): WorkTaskStatus {
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    throw new WbsDomainError('INVALID_PROGRESS', '진척률은 0~100 사이의 정수여야 합니다.');
  }
  if (progress === 0) return 'TODO';
  if (progress === 100) return 'DONE';
  return 'IN_PROGRESS';
}

export function assertWbsTaskVersion(task: WorkTask, expectedVersion: number): void {
  if (task.version !== expectedVersion) {
    throw new WbsDomainError('VERSION_CONFLICT', '다른 사용자가 먼저 작업을 변경했습니다. 최신 내용을 다시 불러오세요.');
  }
}

export function progressForStatus(status: WorkTaskStatus, currentProgress: number): number {
  if (status === 'TODO') return 0;
  if (status === 'DONE') return 100;
  return currentProgress > 0 && currentProgress < 100 ? currentProgress : 50;
}

export function updateTaskProgress(
  actor: ProjectAccessContext,
  project: WorkProject,
  task: WorkTask,
  progress: number,
  now = new Date(),
): WorkTask {
  if (!canUpdateWbsTaskProgress(actor, project, task)) {
    throw new WbsDomainError('FORBIDDEN', '이 작업의 진행 상태를 변경할 권한이 없습니다.');
  }
  const status = statusForProgress(progress);
  const timestamp = now.toISOString();
  return {
    ...task,
    status,
    progress,
    completedAt: status === 'DONE' ? task.completedAt ?? timestamp : null,
    version: task.version + 1,
    updatedBy: actor.userId,
    updatedAt: timestamp,
  };
}

function averageProgress(tasks: WorkTask[]): number {
  if (tasks.length === 0) return 0;
  return Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length);
}

export function deriveProjectWbsProgress(tasks: WorkTask[], projectId: string): number {
  return averageProgress(tasks.filter((task) => task.projectId === projectId));
}

export function derivePhaseProgress(tasks: WorkTask[], phaseId: string): number {
  return averageProgress(tasks.filter((task) => task.phaseId === phaseId));
}

function seoulDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function isTaskOutsideProjectSchedule(project: WorkProject, task: Pick<WorkTask, 'startAt' | 'dueAt'>): boolean {
  return Boolean(
    (project.startAt && task.startAt && seoulDateKey(task.startAt) < seoulDateKey(project.startAt))
    || (project.dueAt && task.dueAt && seoulDateKey(task.dueAt) > seoulDateKey(project.dueAt)),
  );
}
