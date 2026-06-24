import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { decodeFromFirestore, encodeForFirestore } from '@/shared/lib/firestore-codec';
import { roleGroupSchema, type RoleGroup } from '@/domain/roleGroup/schema';
import { ROLE_GROUP_SEED } from '@/data/seeds/roleGroup.seed';

/**
 * 역할그룹 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 * 문서 ID = roleGroup.code. 미설정 시 seed degrade.
 */
const COLL = 'roleGroups';

let memory: RoleGroup[] = ROLE_GROUP_SEED.map((g) => roleGroupSchema.parse(g));

export const roleGroupRepo = {
  async list(): Promise<RoleGroup[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      return snap.docs.map((d) => roleGroupSchema.parse(decodeFromFirestore(d.data())));
    }
    return memory;
  },

  /** 등록/수정(upsert). 메뉴권한 매트릭스 저장 포함. */
  async save(group: RoleGroup): Promise<void> {
    const valid = roleGroupSchema.parse(group);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.code), encodeForFirestore(valid));
      return;
    }
    const i = memory.findIndex((m) => m.code === valid.code);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(code: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, code));
      return;
    }
    memory = memory.filter((m) => m.code !== code);
  },
};
