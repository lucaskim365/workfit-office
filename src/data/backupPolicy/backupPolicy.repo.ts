import { backupPolicySchema, type BackupPolicy } from '@/domain/backupPolicy/schema';
import { BACKUP_POLICY_SEED } from '@/data/seeds/backupPolicy.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 백업 정책 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<BackupPolicy>({
  coll: 'backupPolicies',
  parse: (raw) => {
    const p = backupPolicySchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse backupPolicy:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.id,
  seed: BACKUP_POLICY_SEED.map((it) => backupPolicySchema.parse(it)),
});

export interface BackupPolicyFilter {
  on?: boolean;
  q?: string;
}

function applyFilter(rows: BackupPolicy[], f?: BackupPolicyFilter): BackupPolicy[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (f.on === undefined || it.on === f.on) &&
      (!kw || it.id.toLowerCase().includes(kw) || it.name.toLowerCase().includes(kw)),
  );
}

export const backupPolicyRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: BackupPolicyFilter): Promise<BackupPolicy[]> {
    return applyFilter(await backend.loadAll(), filter);
  },

  async get(id: string): Promise<BackupPolicy | null> {
    return (await backend.loadAll()).find((it) => it.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 정책 ID. */
  async save(item: BackupPolicy): Promise<void> {
    await backend.save(backupPolicySchema.parse(item));
  },

  async remove(id: string): Promise<void> {
    await backend.remove(id);
  },
};
