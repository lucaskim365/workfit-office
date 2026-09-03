import type { User } from '@/domain/user/schema';
import {
  resourceSchema,
  type Resource,
  type ResourceDraft,
  type ResourceStatus,
  type ResourceType,
} from '@/domain/resource/schema';
import { canManageResources, ReservationError } from '@/domain/reservation/engine';
import { RESOURCE_SEED } from '@/data/seeds/resource.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

export interface ResourceFilter {
  typeCode?: ResourceType;
  status?: ResourceStatus;
  q?: string;
}

/**
 * 자원 마스터 컬렉션. 문서 ID = `Resource.id`(`RES-0001`).
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임하고 파생 로직만 여기 유지한다.
 * ([[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 *
 * 문서별 안전 파싱이다. 스키마에 맞지 않는 문서 하나 때문에 목록 전체가
 * 예외로 죽지 않도록 실패한 문서만 건너뛴다.
 */
const backend = createCrudBackend<Resource>({
  coll: 'resources',
  parse: (raw) => {
    const parsed = resourceSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  idOf: (row) => row.id,
  seed: RESOURCE_SEED.map((row) => resourceSchema.parse(row)),
});

const loadAll = (): Promise<Resource[]> => backend.loadAll();
const persist = (row: Resource): Promise<void> => backend.save(row);

const clone = (row: Resource): Resource => ({ ...row });

function nextId(rows: Resource[]): string {
  const max = rows.reduce((value, row) => Math.max(value, Number(row.id.replace(/\D/g, '')) || 0), 0);
  return `RES-${String(max + 1).padStart(4, '0')}`;
}

function applyFilter(rows: Resource[], filter?: ResourceFilter): Resource[] {
  if (!filter) return rows;
  const keyword = filter.q?.trim().toLowerCase() ?? '';
  return rows.filter((row) =>
    (!filter.typeCode || row.typeCode === filter.typeCode)
    && (!filter.status || row.status === filter.status)
    && (!keyword || [row.code, row.name, row.location].some((value) => value.toLowerCase().includes(keyword))),
  );
}

/**
 * 자원 Repository — 저장소 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 정본 패턴)
 * Firebase 미설정 시 in-memory seed 로 graceful degrade.
 */
export const resourceRepo = {
  async list(filter?: ResourceFilter): Promise<Resource[]> {
    const rows = await loadAll();
    return applyFilter(rows, filter).map(clone).sort((a, b) => a.code.localeCompare(b.code));
  },

  async get(id: string): Promise<Resource | null> {
    const rows = await loadAll();
    const found = rows.find((row) => row.id === id);
    return found ? clone(found) : null;
  },

  async save(actor: User, draft: ResourceDraft, id?: string): Promise<Resource> {
    if (!canManageResources(actor)) {
      throw new ReservationError('FORBIDDEN', '관리자만 자원을 등록하거나 수정할 수 있습니다.');
    }
    // 코드 중복·채번·기존 문서 조회가 모두 같은 스냅샷을 봐야 하므로 한 번만 읽는다.
    const rows = await loadAll();
    const duplicate = rows.find(
      (row) => row.id !== id && row.code.toLowerCase() === draft.code.trim().toLowerCase(),
    );
    if (duplicate) throw new ReservationError('INVALID_INPUT', '이미 사용 중인 자원 코드입니다.');

    const now = new Date().toISOString();
    const existing = id ? rows.find((row) => row.id === id) : null;
    if (id && !existing) throw new ReservationError('INVALID_INPUT', '수정할 자원을 찾을 수 없습니다.');

    const valid = resourceSchema.parse({
      ...draft,
      id: existing?.id ?? nextId(rows),
      createdBy: existing?.createdBy ?? actor.id,
      createdAt: existing?.createdAt ?? now,
      updatedBy: actor.id,
      updatedAt: now,
    });
    await persist(valid);
    return clone(valid);
  },

  async delete(actor: User, id: string): Promise<void> {
    if (!canManageResources(actor)) {
      throw new ReservationError('FORBIDDEN', '관리자만 자원을 삭제할 수 있습니다.');
    }
    await backend.remove(id);
  },
};
