import { exclusiveWorkMutation } from '@/data/workManagement/mutation';
import { workProjectRepo } from '@/data/workProject/workProject.repo';
import { deleteWorkTask, loadWorkWbs, readWorkTasks, saveWorkTask } from '@/data/workWbs/workWbs.store';
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
import {
  WorkTaskTreeError,
  joinPath,
  moveSubtree,
  nextSortOrder,
  type TreeNode,
} from '@/domain/workTask/path';
import {
  WORK_TASK_MAX_LEVEL,
  workTaskSchema,
  type WorkTask,
  type WorkTaskDraft,
  type WorkTaskStatus,
} from '@/domain/workTask/schema';

export interface WorkTaskFilter {
  trackId?: string;
  /** 이 과업의 **직속** 자식만. 하위 전체가 아니다. */
  parentId?: string;
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

function taskFor(id: string | null): WorkTask | null {
  if (!id) return null;
  return readWorkTasks().find((task) => task.id === id) ?? null;
}

/** 트리 계산에 넘길 최소 형태로 줄인다. */
function treeNodes(projectId: string): TreeNode[] {
  return readWorkTasks()
    .filter((task) => task.projectId === projectId)
    .map((task) => ({
      id: task.id,
      trackId: task.trackId,
      parentId: task.parentId,
      sortOrder: task.sortOrder,
      path: task.path,
      level: task.level,
    }));
}

/**
 * 트리 순서로 정렬한다 — 트랙 순, 그 안에서 `path` 순.
 *
 * `path`는 조상 순번을 이어 붙인 값이라 문자열 오름차순 하나로 부모 바로 밑에 자식이,
 * 형제끼리는 순번대로 오게 된다([[path.ts]]).
 */
function sortedProjectTasks(projectId: string, filter?: WorkTaskFilter): WorkTask[] {
  const keyword = filter?.query?.trim().toLowerCase();
  return readWorkTasks()
    .filter((task) => task.projectId === projectId)
    .filter((task) => !filter?.trackId || task.trackId === filter.trackId)
    .filter((task) => !filter?.parentId || task.parentId === filter.parentId)
    .filter((task) => !filter?.assigneeUserId || task.assigneeUserId === filter.assigneeUserId)
    .filter((task) => !filter?.status || task.status === filter.status)
    .filter((task) => !keyword || [task.title, task.description].some((value) => value.toLowerCase().includes(keyword)))
    .sort((a, b) => (a.trackId ?? '').localeCompare(b.trackId ?? '')
      || a.path.localeCompare(b.path)
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
      const parent = taskFor(draft.parentId);
      assertTaskReferences(actor, project, parent, draft);

      // 트리 위치를 정한다 — 같은 부모·같은 트랙의 맨 뒤에 붙인다.
      const nodes = treeNodes(project.id);
      const sortOrder = nextSortOrder(nodes, draft.trackId, draft.parentId);
      const level = parent ? parent.level + 1 : 1;
      if (level > WORK_TASK_MAX_LEVEL) {
        throw new WbsDomainError('INVALID_PARENT', `과업은 ${WORK_TASK_MAX_LEVEL}단까지만 나눌 수 있습니다.`);
      }
      const path = joinPath(parent?.path ?? null, sortOrder);

      const now = new Date();
      const timestamp = now.toISOString();
      const created = workTaskSchema.parse({
        ...draft,
        id: nextId(now),
        level,
        path,
        sortOrder,
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
      assertTaskReferences(actor, project, taskFor(current.parentId), { ...draft, parentId: current.parentId, trackId: current.trackId });
      const timestamp = new Date().toISOString();
      const updated = workTaskSchema.parse({
        ...current,
        ...draft,
        id: current.id,
        projectId: current.projectId,
        // 트리 위치는 여기서 바꾸지 않는다. 옮기기는 하위 전체를 함께 갱신해야 해서
        // 별도 연산(`move`)으로 뺐다 — 수정 폼에서 부모만 슬쩍 바뀌면 경로가 어긋난다.
        trackId: current.trackId,
        parentId: current.parentId,
        level: current.level,
        path: current.path,
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

  /**
   * 과업을 다른 상위(또는 다른 트랙) 밑으로 옮긴다. **하위 전체가 따라온다.**
   *
   * 수정(`update`)과 나눈 이유: 옮기기는 문서 여러 건을 갱신하는데 Appwrite에는 트랜잭션이
   * 없다. 도중에 실패하면 `path`가 어긋나지만 `parentId`는 남으므로 `rebuildPaths()`로
   * 복구된다 — 그 복구 경로를 성립시키려면 옮기기가 별도 연산이어야 한다.
   *
   * 순환·깊이 초과는 **저장 전에** 걸러진다([[path.ts]]의 `moveSubtree`).
   */
  move(
    actor: ProjectAccessContext,
    id: string,
    target: { trackId: string | null; parentId: string | null },
  ): Promise<WorkTask> {
    return exclusiveWorkMutation(async () => {
      await loadWorkWbs();
      const current = requireTask(id);
      const project = await requireProject(actor, current.projectId);
      if (!canEditWbsTask(actor, project, current)) {
        throw new WbsDomainError('FORBIDDEN', '작업 작성자 또는 프로젝트 소유자만 작업을 옮길 수 있습니다.');
      }
      if (target.parentId) {
        const parent = taskFor(target.parentId);
        if (!parent || parent.projectId !== project.id) {
          throw new WbsDomainError('INVALID_PARENT', '현재 프로젝트의 상위 과업을 선택하세요.');
        }
      }

      let changed;
      try {
        changed = moveSubtree(treeNodes(project.id), id, target);
      } catch (error) {
        if (error instanceof WorkTaskTreeError) {
          throw new WbsDomainError(error.code === 'DEPTH_EXCEEDED' ? 'INVALID_PARENT' : 'INVALID_PARENT', error.message);
        }
        throw error;
      }

      const timestamp = new Date().toISOString();
      const byId = new Map(readWorkTasks().map((task) => [task.id, task]));
      for (const row of changed) {
        const task = byId.get(row.id);
        if (!task) continue;
        await saveWorkTask(workTaskSchema.parse({
          ...task,
          trackId: row.trackId,
          parentId: row.parentId,
          sortOrder: row.sortOrder,
          path: row.path,
          level: row.level,
          version: task.version + 1,
          updatedBy: actor.userId,
          updatedAt: timestamp,
        }));
      }
      return clone(requireTask(id));
    });
  },

  /**
   * 과업 삭제. **하위가 있으면 거부한다.**
   *
   * 하위를 같이 지우면 실수 한 번으로 서브트리가 통째로 날아가고 되돌릴 방법이 없다.
   * 아래부터 지우게 강제한다.
   */
  remove(actor: ProjectAccessContext, id: string, expectedVersion: number): Promise<WorkTask> {
    return exclusiveWorkMutation(async () => {
      await loadWorkWbs();
      const current = requireTask(id);
      const project = await requireProject(actor, current.projectId);
      if (!canEditWbsTask(actor, project, current)) {
        throw new WbsDomainError('FORBIDDEN', '작업 작성자 또는 프로젝트 소유자만 작업을 삭제할 수 있습니다.');
      }
      assertWbsTaskVersion(current, expectedVersion);
      const children = readWorkTasks().filter((task) => task.parentId === id);
      if (children.length > 0) {
        throw new WbsDomainError('INVALID_PARENT', `하위 과업 ${children.length}건을 먼저 삭제하세요.`);
      }
      await deleteWorkTask(id);
      return clone(current);
    });
  },
};
