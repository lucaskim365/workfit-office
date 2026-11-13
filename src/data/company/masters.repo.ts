import { createCrudBackend, type InsertableCrudBackend } from '@/data/_backend/crudBackend';
import { bizCategorySchema, companyClassSchema, type BizCategory, type CompanyClass } from '@/domain/company/masters';

interface Audited { id: string; name: string; createdBy: string; createdAt: string; updatedBy: string; updatedAt: string }

/** 기준정보 목록 저장소 — 기업분류·사업구분 공용. 지우지 않는다(use=false). */
export function createMasterRepo<T extends Audited>(b: Pick<InsertableCrudBackend<T>, 'loadAll' | 'insert' | 'save'>) {
  return {
    list: () => b.loadAll(),
    async save({ item, isNew, actorId }: { item: T; isNew: boolean; actorId: string }): Promise<T> {
      const now = new Date().toISOString();
      const next: T = {
        ...item,
        name: item.name.trim(),
        ...(isNew ? { createdBy: actorId, createdAt: now } : {}),
        updatedBy: actorId,
        updatedAt: now,
      };
      if (isNew) await b.insert(next);
      else await b.save(next);
      return next;
    },
  };
}

const safe = <T>(schema: { safeParse: (x: unknown) => { success: boolean; data?: T } }) => (raw: unknown): T | null => {
  const p = schema.safeParse(raw);
  return p.success ? (p.data as T) : null;
};

export const companyClassRepo = createMasterRepo(
  createCrudBackend<CompanyClass>({ coll: 'companyClasses', parse: safe(companyClassSchema), idOf: (x) => x.id, seed: [] }),
);
export const bizCategoryRepo = createMasterRepo(
  createCrudBackend<BizCategory>({ coll: 'bizCategories', parse: safe(bizCategorySchema), idOf: (x) => x.id, seed: [] }),
);
