import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
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

export interface ResourceFilter {
  typeCode?: ResourceType;
  status?: ResourceStatus;
  q?: string;
}

/** 자원 마스터 컬렉션. 문서 ID = `Resource.id`(`RES-0001`). */
const COLL = 'resources';

let memory: Resource[] = RESOURCE_SEED.map((row) => resourceSchema.parse(row));

/**
 * 전체 자원 로드(저장소 무관). Firebase 미설정 시 in-memory seed 로 degrade.
 * ([[data-layer-pattern]] 정본 패턴 — `chatMessage.repo.ts` `loadAll` 과 같은 모양)
 *
 * 문서별 안전 파싱이다. 스키마에 맞지 않는 문서 하나 때문에 목록 전체가
 * 예외로 죽지 않도록 실패한 문서만 건너뛴다.
 */
async function loadAll(): Promise<Resource[]> {
  if (isFirebaseConfigured && db) {
    const fdb = db;
    const snap = await getDocs(collection(fdb, COLL));
    const out: Resource[] = [];
    for (const d of snap.docs) {
      const parsed = resourceSchema.safeParse(d.data());
      if (parsed.success) out.push(parsed.data);
    }
    return out;
  }
  return memory;
}

/** 한 건 저장(신규·수정 공통). 문서 ID 를 키로 덮어쓴다. */
async function persist(row: Resource): Promise<void> {
  if (isFirebaseConfigured && db) {
    const fdb = db;
    await setDoc(doc(fdb, COLL, row.id), row);
    return;
  }
  const index = memory.findIndex((item) => item.id === row.id);
  if (index >= 0) memory = memory.map((item, itemIndex) => (itemIndex === index ? row : item));
  else memory = [...memory, row];
}

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
};
