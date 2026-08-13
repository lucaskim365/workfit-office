import { itemSchema, type Item } from '@/domain/item/schema';
import { ITEM_SEED } from '@/data/seeds/item.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 품목 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<Item>({
  coll: 'items',
  parse: (raw) => {
    const p = itemSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse item:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (it) => it.code,
  seed: ITEM_SEED.map((it) => itemSchema.parse(it)),
});

export interface ItemFilter {
  type?: string;
  use?: string;
  q?: string;
}

function applyFilter(rows: Item[], f?: ItemFilter): Item[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.type || it.type === f.type) &&
      (!f.use || it.use === f.use) &&
      (!kw || it.code.toLowerCase().includes(kw) || it.name.toLowerCase().includes(kw)),
  );
}

export const itemRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: ItemFilter): Promise<Item[]> {
    return applyFilter(await backend.loadAll(), filter);
  },

  async get(code: string): Promise<Item | null> {
    return (await backend.loadAll()).find((it) => it.code === code) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 품목코드. */
  async save(item: Item): Promise<void> {
    await backend.save(itemSchema.parse(item));
  },

  async remove(code: string): Promise<void> {
    await backend.remove(code);
  },
};
