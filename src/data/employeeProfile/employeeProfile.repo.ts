import { employeeProfileSchema, type EmployeeProfile } from '@/domain/employeeProfile/schema';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 임직원 인사 프로필 Repository — employeeProfiles 컬렉션 캡슐화.
 */
const backend = createCrudBackend<EmployeeProfile>({
  coll: 'employeeProfiles',
  parse: (raw) => {
    const p = employeeProfileSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse employeeProfile:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.id,
  seed: [],
});

export const employeeProfileRepo = {
  /** 전체 임직원 인사 프로필 목록 조회 */
  async list(): Promise<EmployeeProfile[]> {
    return backend.loadAll();
  },

  /** 단일 프로필 조회 */
  async get(id: string): Promise<EmployeeProfile | null> {
    const all = await backend.loadAll();
    return all.find((p) => p.id === id || p.userId === id) ?? null;
  },

  /** 프로필 등록 또는 수정 (upsert) */
  async save(item: EmployeeProfile): Promise<void> {
    const now = new Date().toISOString();
    await backend.save({
      ...item,
      updatedAt: now,
    });
  },

  /** 단일 프로필 삭제 */
  async delete(id: string): Promise<void> {
    await backend.remove(id);
  },
};
