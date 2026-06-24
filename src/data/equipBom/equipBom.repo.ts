import { collection, doc, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { equipBomSchema, type EquipBom } from '@/domain/equipBom/schema';
import { EQUIP_BOM_SEED } from '@/data/seeds/equipBom.seed';

/**
 * 설비 BOM Repository — 단일 트리(children 임베드) 캡슐화. 조회전용.
 * 문서ID = root code(예: LINE-A). ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 */
const COLL = 'equipBoms';

let memory: EquipBom[] = EQUIP_BOM_SEED.map((b) => equipBomSchema.parse(b));

export const equipBomRepo = {
  async list(): Promise<EquipBom[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      return snap.docs.map((d) => equipBomSchema.parse(d.data()));
    }
    return memory;
  },

  async get(code: string): Promise<EquipBom | null> {
    if (isFirebaseConfigured && db) {
      const snap = await getDoc(doc(db, COLL, code));
      return snap.exists() ? equipBomSchema.parse(snap.data()) : null;
    }
    return memory.find((m) => m.code === code) ?? null;
  },

  async save(bom: EquipBom): Promise<void> {
    const valid = equipBomSchema.parse(bom);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.code), valid);
      return;
    }
    const i = memory.findIndex((m) => m.code === valid.code);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
