import { positionSchema, type Position } from '@/domain/position/schema';
import { POSITION_SEED } from '@/data/seeds/position.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 직급 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<Position>({
  coll: 'positions',
  parse: (raw) => {
    const p = positionSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse position:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.id,
  seed: POSITION_SEED.map((p) => positionSchema.parse(p)),
});

export const positionRepo = {
  async list(): Promise<Position[]> {
    return backend.loadAll();
  },

  async get(id: string): Promise<Position | null> {
    return (await backend.loadAll()).find((p) => p.id === id) ?? null;
  },

  async save(item: Position): Promise<void> {
    await backend.save(positionSchema.parse(item));
  },

  async remove(id: string): Promise<void> {
    await backend.remove(id);
  },
};
