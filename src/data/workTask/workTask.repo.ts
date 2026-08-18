import { exclusiveWorkMutation } from '@/data/workManagement/mutation';
import { workProjectRepo } from '@/data/workProject/workProject.repo';
import { deleteWorkTask, loadWorkWbs, readWorkPhases, readWorkTasks, saveWorkTask } from '@/data/workWbs/workWbs.store';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkProject } from '@/domain/workProject/schema';
import {
  assertTaskReferences,
  assertWbsTaskVersion,
  canCreateWbsTask,
  canEditWbsTask,
  canUpdateWbsTaskProgress,
  updateTaskProgress,
  WbsDomainError,
} from '@/domain/workTask/engine';
import { workTaskSchema, type WorkTask, type WorkTaskDraft, type WorkTaskStatus } from '@/domain/workTask/schema';

export interface WorkTaskFilter {
  phaseId?: string;
  assigneeUserId?: string;
  status?: WorkTaskStatus;
  query?: string;
}

const clone = (task: WorkTask): WorkTask => ({ ...task });

function dateKey(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now).replaceAll('-', '');
}

function nextId(now: Date): string {
  const prefix = `TASK-${dateKey(now)}-`;
  const max = readWorkTasks()
    .filter((task) => task.id.startsWith(prefix))
    .reduce((value, task) => Math.max(value, Number(task.id.slice(-4)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

async function requireProject(actor: ProjectAccessContext, projectId: string): Promise<WorkProject> {
  const project = await workProjectRepo.get(actor, projectId);
  if (!project) throw new WbsDomainError('FORBIDDEN', '프로젝트를 조회할 수 없습니다.');
  return project;
}

function requireTask(id: string): WorkTask {
  const task = readWorkTasks().find((row) => row.id === id);
  if (!task) throw new WbsDomainError('INVALID_PROJECT', 'WBS 작업을 찾을 수 없습니다.');
  return task;
}

function phaseFor(id: string) {
  return readWorkPhases().find((phase) => phase.id === id) ?? null;
}

function sortedProjectTasks(projectId: string, filter?: WorkTaskFilter): WorkTask[] {
  const phaseOrder = new Map(readWorkPhases().map((phase) => [phase.id, phase.sortOrder]));
  const keyword = filter?.query?.trim().toLowerCase();
  return readWorkTasks()
    .filter((task) => task.projectId === projectId)
    .filter((task) => !filter?.phaseId || task.phaseId === filter.phaseId)
    .filter((task) => !filter?.assigneeUserId || task.assigneeUserId === filter.assigneeUserId)
    .filter((task) => !filter?.status || task.status === filter.status)
    .filter((task) => !keyword || [task.title, task.description].some((value) => value.toLowerCase().includes(keyword)))
    .sort((a, b) => (phaseOrder.get(a.phaseId) ?? Number.MAX_SAFE_INTEGER) - (phaseOrder.get(b.phaseId) ?? Number.MAX_SAFE_INTEGER)
      || a.sortOrder - b.sortOrder
      || a.id.localeCompare(b.id))
    .map(clone);
}

export const workTaskRepo = {
  async list(actor: ProjectAccessContext, projectId: string, filter?: WorkTaskFilter): Promise<WorkTask[]> {
    await loadWorkWbs();
    const project = await workProjectRepo.get(actor, projectId);
    return project ? sortedProjectTasks(project.id, filter) : [];
  },

  async get(actor: ProjectAccessContext, id: string): Promise<WorkTask | null> {
    await loadWorkWbs();
    const task = readWorkTasks().find((row) => row.id === id);
    if (!task) return null;
    const project = await workProjectRepo.get(actor, task.projectId);
    return project ? clone(task) : null;
  },

  create(actor: ProjectAccessContext, draft: WorkTaskDraft): Promise<WorkTask> {
    return exclusiveWorkMutation(async () => {
      await loadWorkWbs();
      const project = await requireProject(actor, draft.projectId);
      if (!canCreateWbsTask(actor, project)) {
        throw new WbsDomainError('FORBIDDEN', '프로젝트 참여자만 WBS 작업을 추가할 수 있습니다.');
      }
      assertTaskReferences(project, phaseFor(draft.phaseId), draft);
      const phaseTasks = readWorkTasks().filter((task) => task.phaseId === draft.phaseId);
      const now = new Date();
      const timestamp = now.toISOString();
      const created = workTaskSchema.parse({
        ...draft,
        id: nextId(now),
        sortOrder: Math.max(0, ...phaseTasks.map((task) => task.sortOrder)) + 10,
        completedAt: draft.status === 'DONE' ? timestamp : null,
        version: 1,
        createdBy: actor.userId,
        createdAt: timestamp,
        updatedBy: actor.userId,
        updatedAt: timestamp,
      });
      await saveWorkTask(created);
      return clone(created);
    });
  },

  update(actor: ProjectAccessContext, id: string, draft: WorkTaskDraft, expectedVersion: number): Promise<WorkTask> {
    return exclusiveWorkMutation(async () => {
      await loadWorkWbs();
      const current = requireTask(id);
      const project = await requireProject(actor, current.projectId);
      if (!canEditWbsTask(actor, project, current)) {
        throw new WbsDomainError('FORBIDDEN', '작업 작성자 또는 프로젝트 소유자만 작업을 수정할 수 있습니다.');
      }
      assertWbsTaskVersion(current, expectedVersion);
      assertTaskReferences(project, phaseFor(draft.phaseId), draft);
      const timestamp = new Date().toISOString();
      const updated = workTaskSchema.parse({
        ...current,
        ...draft,
        id: current.id,
        projectId: current.projectId,
        completedAt: draft.status === 'DONE' ? current.completedAt ?? timestamp : null,
        version: current.version + 1,
        createdBy: current.createdBy,
        createdAt: current.createdAt,
        updatedBy: actor.userId,
        updatedAt: timestamp,
      });
      await saveWorkTask(updated);
      return clone(updated);
    });
  },

  setProgress(actor: ProjectAccessContext, id: string, progress: number, expectedVersion: number): Promise<WorkTask> {
    return exclusiveWorkMutation(async () => {
      await loadWorkWbs();
      const current = requireTask(id);
      const project = await requireProject(actor, current.projectId);
      if (!canUpdateWbsTaskProgress(actor, project, current)) {
        throw new WbsDomainError('FORBIDDEN', '이 작업의 진행 상태를 변경할 권한이 없습니다.');
      }
      assertWbsTaskVersion(current, expectedVersion);
      const updated = workTaskSchema.parse(updateTaskProgress(actor, project, current, progress));
      await saveWorkTask(updated);
      return clone(updated);
    });
  },

  remove(actor: ProjectAccessContext, id: string, expectedVersion: number): Promise<WorkTask> {
    return exclusiveWorkMutation(async () => {
      await loadWorkWbs();
      const current = requireTask(id);
      const project = await requireProject(actor, current.projectId);
      if (!canEditWbsTask(actor, project, current)) {
        throw new WbsDomainError('FORBIDDEN', '작업 작성자 또는 프로젝트 소유자만 작업을 삭제할 수 있습니다.');
      }
      assertWbsTaskVersion(current, expectedVersion);
      await deleteWorkTask(id);
      return clone(current);
    });
  },
};
