import { salesCollectionSchema, type SalesCollection } from '@/domain/salesCollection/schema';
import { SALES_COLLECTION_SEED } from '@/data/seeds/salesCollection.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 수금 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<SalesCollection>({
  coll: 'salesCollections',
  parse: (raw) => {
    const p = salesCollectionSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse salesCollection:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.no,
  seed: SALES_COLLECTION_SEED.map((x) => salesCollectionSchema.parse(x)),
});

export interface SalesCollectionFilter {
  method?: string;
  q?: string;
}

function applyFilter(rows: SalesCollection[], f?: SalesCollectionFilter): SalesCollection[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.method || it.method === f.method) &&
      (!kw || it.no.toLowerCase().includes(kw) || it.cust.toLowerCase().includes(kw)),
  );
}

export const salesCollectionRepo = {
  /** 전체 조회 + 클라이언트 필터(로그 규모상 적합). */
  async list(filter?: SalesCollectionFilter): Promise<SalesCollection[]> {
    return applyFilter(await backend.loadAll(), filter);
  },

  async get(no: string): Promise<SalesCollection | null> {
    const rows = await this.list();
    return rows.find((it) => it.no === no) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 수금번호(no). */
  async save(item: SalesCollection): Promise<void> {
    await backend.save(salesCollectionSchema.parse(item));
  },

  async remove(no: string): Promise<void> {
    await backend.remove(no);
  },
};
