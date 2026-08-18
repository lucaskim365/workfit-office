import { exclusiveWorkMutation } from '@/data/workManagement/mutation';
import { workProjectRepo } from '@/data/workProject/workProject.repo';
import { deleteWorkPhase, loadWorkWbs, readWorkPhases, readWorkTasks, saveWorkPhase } from '@/data/workWbs/workWbs.store';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import type { WorkProject } from '@/domain/workProject/schema';
import { workPhaseSchema, type WorkPhase, type WorkPhaseDraft } from '@/domain/workPhase/schema';
import { canManageWbsPhases, WbsDomainError } from '@/domain/workTask/engine';

const clone = (phase: WorkPhase): WorkPhase => ({ ...phase });

function nextId(): string {
  const max = readWorkPhases().reduce((value, phase) => Math.max(value, Number(phase.id.slice(-4)) || 0), 0);
  return `PHASE-${String(max + 1).padStart(4, '0')}`;
}

async function requireProject(actor: ProjectAccessContext, projectId: string): Promise<WorkProject> {
  const project = await workProjectRepo.get(actor, projectId);
  if (!project) throw new WbsDomainError('FORBIDDEN', '프로젝트를 조회할 수 없습니다.');
  return project;
}

function requirePhase(id: string): WorkPhase {
  const phase = readWorkPhases().find((row) => row.id === id);
  if (!phase) throw new WbsDomainError('INVALID_PHASE', 'WBS 단계를 찾을 수 없습니다.');
  return phase;
}

function assertUniqueName(projectId: string, name: string, exceptId?: string): void {
  const normalized = name.trim().toLowerCase();
  if (readWorkPhases().some((phase) => phase.projectId === projectId && phase.id !== exceptId && phase.name.toLowerCase() === normalized)) {
    throw new WbsDomainError('INVALID_PHASE', '같은 프로젝트에서 단계명을 중복 사용할 수 없습니다.');
  }
}

export const workPhaseRepo = {
  async list(actor: ProjectAccessContext, projectId: string): Promise<WorkPhase[]> {
    await loadWorkWbs();
    const project = await workProjectRepo.get(actor, projectId);
    if (!project) return [];
    return readWorkPhases()
      .filter((phase) => phase.projectId === project.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
      .map(clone);
  },

  create(actor: ProjectAccessContext, draft: WorkPhaseDraft): Promise<WorkPhase> {
    return exclusiveWorkMutation(async () => {
      await loadWorkWbs();
      const project = await requireProject(actor, draft.projectId);
      if (!canManageWbsPhases(actor, project)) {
        throw new WbsDomainError('FORBIDDEN', '프로젝트 소유자만 WBS 단계를 추가할 수 있습니다.');
      }
      assertUniqueName(project.id, draft.name);
      const projectPhases = readWorkPhases().filter((phase) => phase.projectId === project.id);
      const now = new Date().toISOString();
      const created = workPhaseSchema.parse({
        ...draft,
        id: nextId(),
        sortOrder: Math.max(0, ...projectPhases.map((phase) => phase.sortOrder)) + 10,
        createdBy: actor.userId,
        createdAt: now,
        updatedBy: actor.userId,
        updatedAt: now,
      });
      await saveWorkPhase(created);
      return clone(created);
    });
  },

  update(actor: ProjectAccessContext, id: string, name: string): Promise<WorkPhase> {
    return exclusiveWorkMutation(async () => {
      await loadWorkWbs();
      const current = requirePhase(id);
      const project = await requireProject(actor, current.projectId);
      if (!canManageWbsPhases(actor, project)) {
        throw new WbsDomainError('FORBIDDEN', '프로젝트 소유자만 WBS 단계를 수정할 수 있습니다.');
      }
      assertUniqueName(project.id, name, id);
      const updated = workPhaseSchema.parse({
        ...current,
        name,
        updatedBy: actor.userId,
        updatedAt: new Date().toISOString(),
      });
      await saveWorkPhase(updated);
      return clone(updated);
    });
  },

  remove(actor: ProjectAccessContext, id: string): Promise<WorkPhase> {
    return exclusiveWorkMutation(async () => {
      await loadWorkWbs();
      const current = requirePhase(id);
      const project = await requireProject(actor, current.projectId);
      if (!canManageWbsPhases(actor, project)) {
        throw new WbsDomainError('FORBIDDEN', '프로젝트 소유자만 WBS 단계를 삭제할 수 있습니다.');
      }
      if (readWorkTasks().some((task) => task.phaseId === id)) {
        throw new WbsDomainError('INVALID_PHASE', '작업이 있는 단계는 삭제할 수 없습니다.');
      }
      await deleteWorkPhase(id);
      return clone(current);
    });
  },
};
