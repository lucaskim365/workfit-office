import { sysAdminSchema, type SysAdmin } from '@/domain/sysAdmin/schema';
import { SYS_ADMIN_SEED } from '@/data/seeds/sysAdmin.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 시스템 관리자 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<SysAdmin>({
  coll: 'sysAdmins',
  parse: (raw) => {
    const p = sysAdminSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse sysAdmin:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.id,
  seed: SYS_ADMIN_SEED.map((it) => sysAdminSchema.parse(it)),
});

export interface SysAdminFilter {
  level?: string;
  status?: string;
  q?: string;
}

function applyFilter(rows: SysAdmin[], f?: SysAdminFilter): SysAdmin[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.level || it.level === f.level) &&
      (!f.status || it.status === f.status) &&
      (!kw || it.id.toLowerCase().includes(kw) || it.name.toLowerCase().includes(kw)),
  );
}

export const sysAdminRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: SysAdminFilter): Promise<SysAdmin[]> {
    return applyFilter(await backend.loadAll(), filter);
  },

  async get(id: string): Promise<SysAdmin | null> {
    return (await backend.loadAll()).find((it) => it.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 계정 ID. */
  async save(item: SysAdmin): Promise<void> {
    await backend.save(sysAdminSchema.parse(item));
  },

  async remove(id: string): Promise<void> {
    await backend.remove(id);
  },
};
