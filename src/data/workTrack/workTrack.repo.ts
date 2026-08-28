import { createCrudBackend } from '@/data/_backend/crudBackend';
import { exclusiveWorkMutation } from '@/data/workManagement/mutation';
import { workProjectRepo } from '@/data/workProject/workProject.repo';
import { readWorkTasks, loadWorkWbs } from '@/data/workWbs/workWbs.store';
import type { ProjectAccessContext } from '@/domain/workProject/engine';
import { WbsDomainError, canManageWbsPhases } from '@/domain/workTask/engine';
import {
  DEFAULT_TRACK_COLORS,
  DEFAULT_TRACK_NAMES,
  workTrackSchema,
  type WorkTrack,
  type WorkTrackDraft,
} from '@/domain/workTrack/schema';
import { dbDriver } from '@/shared/lib/dbDriver';
import { WORK_TRACK_FIXTURE } from './workTrack.fixture';

/**
 * 프로젝트 트랙 저장소.
 * ([[프로젝트관리_고도화_계획서.md]] §2, §10.2)
 *
 * 트랙은 과업이 아니라 과업이 매달리는 옆칸이다 — 이름·순서·색만 가진다.
 * 개수는 0~N개고, 0개면 대과업이 최상위가 된다.
 */

const backend = createCrudBackend<WorkTrack>({
  coll: 'workTracks',
  parse: (raw) => {
    const parsed = workTrackSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  idOf: (row) => row.id,
  seed: WORK_TRACK_FIXTURE.map((row) => ({ ...row })),
});

let cache: WorkTrack[] = WORK_TRACK_FIXTURE.map((row) => ({ ...row }));

async function load(): Promise<void> {
  if (dbDriver === 'memory') return;
  cache = await backend.loadAll();
}

async function persist(row: WorkTrack): Promise<void> {
  if (dbDriver !== 'memory') await backend.save(row);
  const index = cache.findIndex((item) => item.id === row.id);
  cache = index >= 0 ? cache.map((item, i) => (i === index ? row : item)) : [...cache, row];
}

async function drop(id: string): Promise<void> {
  if (dbDriver !== 'memory') await backend.remove(id);
  cache = cache.filter((row) => row.id !== id);
}

function nextId(): string {
  const max = cache.reduce((value, row) => Math.max(value, Number(row.id.slice(-4)) || 0), 0);
  return `TRK-${String(max + 1).padStart(4, '0')}`;
}

const clone = (row: WorkTrack): WorkTrack => ({ ...row });

function sorted(projectId: string): WorkTrack[] {
  return cache
    .filter((row) => row.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .map(clone);
}

async function requireProject(actor: ProjectAccessContext, projectId: string) {
  const project = await workProjectRepo.get(actor, projectId);
  if (!project) throw new WbsDomainError('FORBIDDEN', '프로젝트를 조회할 수 없습니다.');
  return project;
}

export const workTrackRepo = {
  async list(actor: ProjectAccessContext, projectId: string): Promise<WorkTrack[]> {
    await load();
    const project = await workProjectRepo.get(actor, projectId);
    return project ? sorted(project.id) : [];
  },

  create(actor: ProjectAccessContext, draft: WorkTrackDraft): Promise<WorkTrack> {
    return exclusiveWorkMutation(async () => {
      await load();
      const project = await requireProject(actor, draft.projectId);
      if (!canManageWbsPhases(actor, project)) {
        throw new WbsDomainError('FORBIDDEN', '프로젝트 소유자만 트랙을 관리할 수 있습니다.');
      }
      assertNameFree(draft.projectId, draft.name, null);
      const timestamp = new Date().toISOString();
      const created = workTrackSchema.parse({
        ...draft,
        id: nextId(),
        sortOrder: sorted(project.id).length,
        createdBy: actor.userId,
        createdAt: timestamp,
        updatedBy: actor.userId,
        updatedAt: timestamp,
      });
      await persist(created);
      return clone(created);
    });
  },

  rename(actor: ProjectAccessContext, id: string, name: string): Promise<WorkTrack> {
    return exclusiveWorkMutation(async () => {
      await load();
      const current = cache.find((row) => row.id === id);
      if (!current) throw new WbsDomainError('INVALID_PROJECT', '트랙을 찾을 수 없습니다.');
      const project = await requireProject(actor, current.projectId);
      if (!canManageWbsPhases(actor, project)) {
        throw new WbsDomainError('FORBIDDEN', '프로젝트 소유자만 트랙을 관리할 수 있습니다.');
      }
      assertNameFree(current.projectId, name, id);
      const updated = workTrackSchema.parse({
        ...current,
        name,
        updatedBy: actor.userId,
        updatedAt: new Date().toISOString(),
      });
      await persist(updated);
      return clone(updated);
    });
  },

  /**
   * 트랙 삭제. **과업이 걸려 있으면 거부한다.**
   *
   * 지우면서 과업을 트랙 없음으로 밀어내면, 트랙이 있는 프로젝트에서 최상위가 둘(트랙과
   * 떠도는 대과업)이 되어 리포트 서식이 무너진다. 과업을 먼저 옮기게 강제한다.
   */
  remove(actor: ProjectAccessContext, id: string): Promise<void> {
    return exclusiveWorkMutation(async () => {
      await load();
      await loadWorkWbs();
      const current = cache.find((row) => row.id === id);
      if (!current) throw new WbsDomainError('INVALID_PROJECT', '트랙을 찾을 수 없습니다.');
      const project = await requireProject(actor, current.projectId);
      if (!canManageWbsPhases(actor, project)) {
        throw new WbsDomainError('FORBIDDEN', '프로젝트 소유자만 트랙을 관리할 수 있습니다.');
      }
      const attached = readWorkTasks().filter((task) => task.trackId === id);
      if (attached.length > 0) {
        throw new WbsDomainError('INVALID_TRACK', `이 트랙의 과업 ${attached.length}건을 먼저 옮기거나 삭제하세요.`);
      }
      await drop(id);
    });
  },

  /**
   * 프로젝트를 만들 때 기본 트랙을 채운다. **편의일 뿐 강제가 아니다** —
   * 사용자가 지우거나 이름을 바꾸거나 0개로 만들어도 된다.
   */
  seedDefaults(actor: ProjectAccessContext, projectId: string): Promise<WorkTrack[]> {
    return exclusiveWorkMutation(async () => {
      await load();
      const timestamp = new Date().toISOString();
      const created: WorkTrack[] = [];
      for (const [index, name] of DEFAULT_TRACK_NAMES.entries()) {
        const row = workTrackSchema.parse({
          id: nextId(),
          projectId,
          name,
          sortOrder: index,
          color: DEFAULT_TRACK_COLORS[index] ?? '#94a3b8',
          createdBy: actor.userId,
          createdAt: timestamp,
          updatedBy: actor.userId,
          updatedAt: timestamp,
        });
        await persist(row); // nextId 가 캐시를 보므로 한 건씩 반영해야 번호가 안 겹친다
        created.push(clone(row));
      }
      return created;
    });
  },
};

/** 같은 프로젝트에 같은 이름 트랙이 둘이면 리포트에서 어느 쪽인지 구분할 수 없다. */
function assertNameFree(projectId: string, name: string, exceptId: string | null): void {
  const trimmed = name.trim();
  const clash = cache.some((row) => row.projectId === projectId && row.id !== exceptId && row.name === trimmed);
  if (clash) throw new WbsDomainError('INVALID_TRACK', '같은 이름의 트랙이 이미 있습니다.');
}
