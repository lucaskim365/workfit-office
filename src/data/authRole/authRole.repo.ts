import { decodeFromFirestore, encodeForFirestore } from '@/shared/lib/firestore-codec';
import { authRoleSchema, type AuthRole } from '@/domain/authRole/schema';
import { AUTH_ROLE_SEED } from '@/data/seeds/authRole.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 권한 역할 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<AuthRole>({
  coll: 'authRoles',
  parse: (raw) => {
    const p = authRoleSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse authRole:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.code,
  seed: AUTH_ROLE_SEED.map((r) => authRoleSchema.parse(r)),
  jsonFields: ['permissions'],
  firestoreEncode: encodeForFirestore,
  firestoreDecode: decodeFromFirestore,
});

export interface AuthRoleFilter {
  q?: string;
}

function applyFilter(rows: AuthRole[], f?: AuthRoleFilter): AuthRole[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter((r) => !kw || r.code.toLowerCase().includes(kw) || r.name.toLowerCase().includes(kw));
}

export const authRoleRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: AuthRoleFilter): Promise<AuthRole[]> {
    return applyFilter(await backend.loadAll(), filter);
  },

  async get(code: string): Promise<AuthRole | null> {
    const rows = await this.list();
    return rows.find((r) => r.code === code) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 역할 코드. */
  async save(role: AuthRole): Promise<void> {
    await backend.save(authRoleSchema.parse(role));
  },
};
