import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { WORK_PROJECT_SEED } from '@/data/seeds/workProject.seed';
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

/** 프로젝트 컬렉션. 문서 ID = `WorkProject.id`(`PRJ-0001`). */
const COLL = 'workProjects';

let memory: WorkProject[] = WORK_PROJECT_SEED.map(cloneProject);

function cloneProject(project: WorkProject): WorkProject {
  return { ...project, memberUserIds: [...project.memberUserIds] };
}

/**
 * 전체 프로젝트 로드(저장소 무관). Firebase 미설정 시 in-memory seed 로 graceful degrade.
 * ([[data-layer-pattern]] 정본 패턴)
 *
 * 열람 권한(`canViewProject`)은 문서를 읽은 뒤 코드에서 거른다. rules 가
 * UI-게이트 모델이라 DB 단에서 막지 못한다는 뜻이기도 하다. [[DEPLOY_PREP.md]] §2.4.
 */
async function loadAll(): Promise<WorkProject[]> {
  if (isFirebaseConfigured && db) {
    const fdb = db;
    const snap = await getDocs(collection(fdb, COLL));
    const out: WorkProject[] = [];
    for (const d of snap.docs) {
      const parsed = workProjectSchema.safeParse(d.data());
      if (parsed.success) out.push(parsed.data);
    }
    return out;
  }
  return memory;
}

/** 한 건 저장(신규·수정 공통). */
async function persist(row: WorkProject): Promise<void> {
  if (isFirebaseConfigured && db) {
    const fdb = db;
    await setDoc(doc(fdb, COLL, row.id), row);
    return;
  }
  const index = memory.findIndex((item) => item.id === row.id);
  if (index >= 0) memory = memory.map((item, itemIndex) => (itemIndex === index ? row : item));
  else memory = [...memory, row];
}

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
