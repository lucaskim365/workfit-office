import { systemLogSchema, type SystemLog } from '@/domain/systemLog/schema';
import { SYSTEM_LOG_SEED } from '@/data/seeds/systemLog.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 시스템 로그 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<SystemLog>({
  coll: 'systemLogs',
  parse: (raw) => {
    const p = systemLogSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse systemLog:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.id,
  seed: SYSTEM_LOG_SEED.map((it) => systemLogSchema.parse(it)),
});

export interface SystemLogFilter {
  type?: string;
  q?: string;
}

function applyFilter(rows: SystemLog[], f?: SystemLogFilter): SystemLog[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.type || it.type === f.type) &&
      (!kw || it.user.toLowerCase().includes(kw)),
  );
}

export const systemLogRepo = {
  /** 전체 조회 + 클라이언트 필터(로그 규모상 적합). */
  async list(filter?: SystemLogFilter): Promise<SystemLog[]> {
    return applyFilter(await backend.loadAll(), filter);
  },

  async get(id: string): Promise<SystemLog | null> {
    return (await backend.loadAll()).find((it) => it.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 로그 id. */
  async save(item: SystemLog): Promise<void> {
    await backend.save(systemLogSchema.parse(item));
  },
};
