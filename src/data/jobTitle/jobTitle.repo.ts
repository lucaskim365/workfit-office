import { jobTitleSchema, type JobTitle } from '@/domain/jobTitle/schema';
import { JOB_TITLE_SEED } from '@/data/seeds/jobTitle.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 직책 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<JobTitle>({
  coll: 'jobTitles',
  parse: (raw) => {
    const p = jobTitleSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse jobTitle:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.id,
  seed: JOB_TITLE_SEED.map((j) => jobTitleSchema.parse(j)),
});

export const jobTitleRepo = {
  async list(): Promise<JobTitle[]> {
    return backend.loadAll();
  },

  async get(id: string): Promise<JobTitle | null> {
    return (await backend.loadAll()).find((j) => j.id === id) ?? null;
  },

  async save(item: JobTitle): Promise<void> {
    await backend.save(jobTitleSchema.parse(item));
  },

  async remove(id: string): Promise<void> {
    await backend.remove(id);
  },
};
