import { createCrudBackend } from '@/data/_backend/crudBackend';
import { exclusiveWorkMutation } from '@/data/workManagement/mutation';
import { workProjectRepo } from '@/data/workProject/workProject.repo';
import { loadWorkWbs, readWorkTasks } from '@/data/workWbs/workWbs.store';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import { WbsDomainError } from '@/domain/workTask/engine';
import { descendantPrefix } from '@/domain/workTask/path';
import {
  workTaskCommentSchema,
  workTaskFileSchema,
  type WorkTaskComment,
  type WorkTaskCommentDraft,
  type WorkTaskFile,
} from '@/domain/workTaskNote/schema';
import { dbDriver } from '@/shared/lib/dbDriver';
import { fileStorage } from '@/shared/lib/storage';

/**
 * 과업 댓글·첨부 저장소.
 * ([[프로젝트관리_고도화_계획서.md]] §6)
 *
 * `taskId`가 `null`이면 프로젝트 직속이다. 조회는 두 가지 모양을 지원한다 —
 * **이 과업만**과 **하위 포함**. 하위 포함은 `path` prefix로 서브트리 과업 id를 먼저
 * 모은 뒤 그 집합으로 거른다(Appwrite에 조인이 없다).
 */

function dateKey(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now).replaceAll('-', '');
}

// ── 댓글 ──
const commentBackend = createCrudBackend<WorkTaskComment>({
  coll: 'workTaskComments',
  parse: (raw) => {
    const parsed = workTaskCommentSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  idOf: (row) => row.id,
  seed: [],
});

let comments: WorkTaskComment[] = [];

// ── 첨부 ──
const fileBackend = createCrudBackend<WorkTaskFile>({
  coll: 'workTaskFiles',
  parse: (raw) => {
    const parsed = workTaskFileSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  idOf: (row) => row.id,
  seed: [],
});

let files: WorkTaskFile[] = [];

async function load(): Promise<void> {
  if (dbDriver === 'memory') return;
  const [nextComments, nextFiles] = await Promise.all([commentBackend.loadAll(), fileBackend.loadAll()]);
  comments = nextComments;
  files = nextFiles;
}

function nextId(prefix: 'CMT' | 'FIL', rows: Array<{ id: string }>, now: Date): string {
  const head = `${prefix}-${dateKey(now)}-`;
  const max = rows
    .filter((row) => row.id.startsWith(head))
    .reduce((value, row) => Math.max(value, Number(row.id.slice(-4)) || 0), 0);
  return `${head}${String(max + 1).padStart(4, '0')}`;
}

async function requireProject(actor: ProjectAccessContext, projectId: string) {
  const project = await workProjectRepo.get(actor, projectId);
  if (!project) throw new WbsDomainError('FORBIDDEN', '프로젝트를 조회할 수 없습니다.');
  return project;
}

/**
 * 대상 과업 집합 — `null`이면 프로젝트 직속만, 과업 id면 그 과업(옵션으로 하위 전체).
 *
 * 하위 포함은 `trackId` 일치 + `path` prefix로 모은다. 재귀 쿼리가 없으니 이미 읽어 둔
 * 과업 목록에서 걸러 내는 편이 왕복 한 번으로 끝난다.
 */
function scopeIds(projectId: string, taskId: string | null, includeSubtree: boolean): Set<string> | null {
  if (taskId === null) return null; // 프로젝트 직속
  if (!includeSubtree) return new Set([taskId]);
  const tasks = readWorkTasks().filter((task) => task.projectId === projectId);
  const root = tasks.find((task) => task.id === taskId);
  if (!root) return new Set([taskId]);
  const prefix = descendantPrefix(root.path);
  const ids = tasks
    .filter((task) => task.id === taskId || (task.trackId === root.trackId && task.path.startsWith(prefix)))
    .map((task) => task.id);
  return new Set(ids);
}

function inScope(row: { taskId: string | null }, scope: Set<string> | null): boolean {
  return scope === null ? row.taskId === null : row.taskId !== null && scope.has(row.taskId);
}

export interface NoteScope {
  projectId: string;
  /** null이면 프로젝트 직속. */
  taskId: string | null;
  /** 하위 과업 것까지 함께 볼지. 프로젝트 직속(taskId=null)에는 영향이 없다. */
  includeSubtree?: boolean;
}

export const workTaskNoteRepo = {
  async listComments(actor: ProjectAccessContext, scope: NoteScope): Promise<WorkTaskComment[]> {
    await load();
    await loadWorkWbs();
    const project = await workProjectRepo.get(actor, scope.projectId);
    if (!project) return [];
    const ids = scopeIds(project.id, scope.taskId, scope.includeSubtree ?? false);
    return comments
      .filter((row) => row.projectId === project.id && inScope(row, ids))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map((row) => ({ ...row }));
  },

  addComment(actor: ProjectAccessContext, draft: WorkTaskCommentDraft): Promise<WorkTaskComment> {
    return exclusiveWorkMutation(async () => {
      await load();
      const project = await requireProject(actor, draft.projectId);
      if (!project.memberUserIds.includes(actor.userId)) {
        throw new WbsDomainError('FORBIDDEN', '프로젝트 참여자만 댓글을 남길 수 있습니다.');
      }
      const now = new Date();
      const timestamp = now.toISOString();
      const created = workTaskCommentSchema.parse({
        ...draft,
        id: nextId('CMT', comments, now),
        authorUserId: actor.userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      if (dbDriver !== 'memory') await commentBackend.save(created);
      comments = [...comments, created];
      return { ...created };
    });
  },

  /** 댓글 삭제는 **작성자 본인만**. 남의 발언을 소유자가 지우면 기록이 아니라 검열이 된다. */
  removeComment(actor: ProjectAccessContext, id: string): Promise<void> {
    return exclusiveWorkMutation(async () => {
      await load();
      const current = comments.find((row) => row.id === id);
      if (!current) throw new WbsDomainError('INVALID_PROJECT', '댓글을 찾을 수 없습니다.');
      if (current.authorUserId !== actor.userId) {
        throw new WbsDomainError('FORBIDDEN', '작성자만 댓글을 삭제할 수 있습니다.');
      }
      const replies = comments.filter((row) => row.parentId === id);
      if (replies.length > 0) {
        throw new WbsDomainError('FORBIDDEN', `답글 ${replies.length}건이 달려 있어 삭제할 수 없습니다.`);
      }
      if (dbDriver !== 'memory') await commentBackend.remove(id);
      comments = comments.filter((row) => row.id !== id);
    });
  },

  async listFiles(actor: ProjectAccessContext, scope: NoteScope): Promise<WorkTaskFile[]> {
    await load();
    await loadWorkWbs();
    const project = await workProjectRepo.get(actor, scope.projectId);
    if (!project) return [];
    const ids = scopeIds(project.id, scope.taskId, scope.includeSubtree ?? false);
    return files
      .filter((row) => row.projectId === project.id && inScope(row, ids))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt) || a.id.localeCompare(b.id))
      .map((row) => ({ ...row }));
  },

  /** 프로젝트에 딸린 파일 전체 — 상세 메인의 "파일" 칸이 쓴다(과업에 묶인 것 + 직속). */
  async listAllFiles(actor: ProjectAccessContext, projectId: string): Promise<WorkTaskFile[]> {
    await load();
    const project = await workProjectRepo.get(actor, projectId);
    if (!project) return [];
    return files
      .filter((row) => row.projectId === project.id)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt) || a.id.localeCompare(b.id))
      .map((row) => ({ ...row }));
  },

  /**
   * 파일 업로드 — 저장소에 먼저 올리고 메타를 기록한다.
   *
   * 순서가 중요하다. 메타를 먼저 쓰면 업로드가 실패했을 때 **열리지 않는 파일 항목**이
   * 목록에 남는다. 반대로 저장소만 성공하고 메타가 실패하면 고아 파일이 남지만 그건
   * 사용자에게 보이지 않고 용량만 먹는다 — 둘 중 덜 나쁜 쪽을 고른다.
   */
  upload(
    actor: ProjectAccessContext,
    scope: { projectId: string; taskId: string | null },
    file: File,
  ): Promise<WorkTaskFile> {
    return exclusiveWorkMutation(async () => {
      await load();
      const project = await requireProject(actor, scope.projectId);
      if (!project.memberUserIds.includes(actor.userId)) {
        throw new WbsDomainError('FORBIDDEN', '프로젝트 참여자만 파일을 올릴 수 있습니다.');
      }
      const now = new Date();
      const id = nextId('FIL', files, now);
      const storagePath = `workProjects/${project.id}/${id}`;
      const url = await fileStorage.put(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        filename: file.name,
      });
      const created = workTaskFileSchema.parse({
        id,
        projectId: project.id,
        taskId: scope.taskId,
        name: file.name,
        url,
        storagePath,
        size: file.size,
        contentType: file.type || 'application/octet-stream',
        uploadedBy: actor.userId,
        uploadedAt: now.toISOString(),
      });
      if (dbDriver !== 'memory') await fileBackend.save(created);
      files = [...files, created];
      return { ...created };
    });
  },

  /** 파일 삭제 — 올린 사람이나 프로젝트 소유자. 저장소 삭제는 best-effort다. */
  removeFile(actor: ProjectAccessContext, id: string): Promise<void> {
    return exclusiveWorkMutation(async () => {
      await load();
      const current = files.find((row) => row.id === id);
      if (!current) throw new WbsDomainError('INVALID_PROJECT', '파일을 찾을 수 없습니다.');
      const project = await requireProject(actor, current.projectId);
      if (current.uploadedBy !== actor.userId && project.ownerUserId !== actor.userId) {
        throw new WbsDomainError('FORBIDDEN', '올린 사람 또는 프로젝트 소유자만 파일을 지울 수 있습니다.');
      }
      if (dbDriver !== 'memory') await fileBackend.remove(id);
      files = files.filter((row) => row.id !== id);
      // 메타를 지운 뒤 저장소를 지운다. 저장소 삭제가 실패해도 목록에서는 사라진 상태다.
      await fileStorage.remove(current.storagePath).catch(() => undefined);
    });
  },
};
