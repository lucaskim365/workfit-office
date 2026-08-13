import { decodeFromFirestore, encodeForFirestore } from '@/shared/lib/firestore-codec';
import { roleGroupSchema, type RoleGroup } from '@/domain/roleGroup/schema';
import { ROLE_GROUP_SEED } from '@/data/seeds/roleGroup.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 역할그룹 Repository — DB 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 * 문서 ID = roleGroup.code. 저장은 공유 CrudBackend로 위임.
 */
const backend = createCrudBackend<RoleGroup>({
  coll: 'roleGroups',
  parse: (raw) => {
    const p = roleGroupSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse roleGroup:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (x) => x.code,
  seed: ROLE_GROUP_SEED.map((g) => roleGroupSchema.parse(g)),
  jsonFields: ['members', 'permissions'],
  firestoreEncode: encodeForFirestore,
  firestoreDecode: decodeFromFirestore,
});

export const roleGroupRepo = {
  async list(): Promise<RoleGroup[]> {
    return backend.loadAll();
  },

  /** 등록/수정(upsert). 메뉴권한 매트릭스 저장 포함. */
  async save(group: RoleGroup): Promise<void> {
    await backend.save(roleGroupSchema.parse(group));
  },

  async remove(code: string): Promise<void> {
    await backend.remove(code);
  },
};
