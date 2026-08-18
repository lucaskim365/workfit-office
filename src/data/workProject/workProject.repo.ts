import { WORK_PROJECT_SEED } from '@/data/seeds/workProject.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';
import { exclusiveWorkMutation } from '@/data/workManagement/mutation';
import { loadWorkWbs, readWorkTasks } from '@/data/workWbs/workWbs.store';
import {
  assertCanCreateProject,
  assertCanManageProject,
  canViewProject,
  ProjectDomainError,
  type ProjectAccessContext,
} from '@/domain/workProject/engine';
import {
  workProjectSchema,
  type WorkProject,
  type WorkProjectDraft,
  type WorkProjectStatus,
} from '@/domain/workProject/schema';

export interface WorkProjectFilter {
  status?: WorkProjectStatus;
  query?: string;
  ownedOnly?: boolean;
  memberOnly?: boolean;
}

function cloneProject(project: WorkProject): WorkProject {
  return { ...project, memberUserIds: [...project.memberUserIds] };
}

/**
 * 프로젝트 컬렉션. 문서 ID = `WorkProject.id`(`PRJ-0001`).
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임하고 파생 로직만 여기 유지한다.
 * ([[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 *
 * 열람 권한(`canViewProject`)은 문서를 읽은 뒤 코드에서 거른다. 저장소 권한이
 * UI-게이트 모델이라 DB 단에서 막지 못한다는 뜻이기도 하다. [[DEPLOY_PREP.md]] §2.4.
 */
const backend = createCrudBackend<WorkProject>({
  coll: 'workProjects',
  parse: (raw) => {
    const parsed = workProjectSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  idOf: (row) => row.id,
  seed: WORK_PROJECT_SEED.map(cloneProject),
});

const loadAll = (): Promise<WorkProject[]> => backend.loadAll();
const persist = (row: WorkProject): Promise<void> => backend.save(row);

function nextId(rows: WorkProject[]): string {
  const max = rows.reduce((value, row) => Math.max(value, Number(row.id.match(/(\d{4})$/)?.[1]) || 0), 0);
  return `PRJ-${String(max + 1).padStart(4, '0')}`;
}

function assertUniqueCode(rows: WorkProject[], code: string, exceptId?: string): void {
  if (rows.some((row) => row.id !== exceptId && row.code.toLowerCase() === code.toLowerCase())) {
    throw new ProjectDomainError('INVALID_PROJECT', '이미 사용 중인 프로젝트 코드입니다.');
  }
}

function requireProject(rows: WorkProject[], id: string): WorkProject {
  const project = rows.find((row) => row.id === id);
  if (!project) throw new ProjectDomainError('INVALID_PROJECT', '프로젝트를 찾을 수 없습니다.');
  return project;
}

function assertAssignedMembersRemain(projectId: string, memberUserIds: string[]): void {
  const assignedUserIds = new Set(
    readWorkTasks()
      .filter((task) => task.projectId === projectId)
      .map((task) => task.assigneeUserId),
  );
  const removedAssignee = [...assignedUserIds].find((userId) => !memberUserIds.includes(userId));
  if (removedAssignee) {
    throw new ProjectDomainError(
      'INVALID_PROJECT',
      'WBS 작업 담당자로 지정된 참여자는 먼저 작업 담당자를 변경해야 제거할 수 있습니다.',
    );
  }
}

export const workProjectRepo = {
  async list(actor: ProjectAccessContext, filter?: WorkProjectFilter): Promise<WorkProject[]> {
    const keyword = filter?.query?.trim().toLowerCase();
    const rows = await loadAll();
    return rows
      .filter((project) => canViewProject(actor, project))
      .filter((project) => !filter?.status || project.status === filter.status)
      .filter((project) => !filter?.ownedOnly || project.ownerUserId === actor.userId)
      .filter((project) => !filter?.memberOnly || project.memberUserIds.includes(actor.userId))
      .filter((project) => !keyword || [project.code, project.name, project.description].some((value) => value.toLowerCase().includes(keyword)))
      .map(cloneProject)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(actor: ProjectAccessContext, id: string): Promise<WorkProject | null> {
    const rows = await loadAll();
    const project = rows.find((row) => row.id === id);
    return project && canViewProject(actor, project) ? cloneProject(project) : null;
  },

  create(actor: ProjectAccessContext, draft: WorkProjectDraft): Promise<WorkProject> {
    return exclusiveWorkMutation(async () => {
      assertCanCreateProject(actor);
      if (draft.ownerUserId !== actor.userId) {
        throw new ProjectDomainError('FORBIDDEN', '새 프로젝트의 소유자는 생성자여야 합니다.');
      }
      const rows = await loadAll();
      assertUniqueCode(rows, draft.code);
      const now = new Date().toISOString();
      const project = workProjectSchema.parse({
        ...draft,
        id: nextId(rows),
        createdBy: actor.userId,
        createdAt: now,
        updatedBy: actor.userId,
        updatedAt: now,
      });
      await persist(project);
      return cloneProject(project);
    });
  },

  update(actor: ProjectAccessContext, id: string, draft: WorkProjectDraft): Promise<WorkProject> {
    return exclusiveWorkMutation(async () => {
      const rows = await loadAll();
      const current = requireProject(rows, id);
      assertCanManageProject(actor, current);
      if (current.status === 'COMPLETED') {
        throw new ProjectDomainError('FORBIDDEN', '완료된 프로젝트는 수정할 수 없습니다.');
      }
      if (draft.ownerUserId !== current.ownerUserId) {
        throw new ProjectDomainError('FORBIDDEN', '프로젝트 소유자 변경은 지원하지 않습니다.');
      }
      // 참여자에서 빠지는 사람이 WBS 작업 담당자인지 보려면 최신 작업 목록이 필요하다.
      await loadWorkWbs();
      assertAssignedMembersRemain(id, draft.memberUserIds);
      assertUniqueCode(rows, draft.code, id);
      const updated = workProjectSchema.parse({
        ...current,
        ...draft,
        updatedBy: actor.userId,
        updatedAt: new Date().toISOString(),
      });
      await persist(updated);
      return cloneProject(updated);
    });
  },
};
