import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { bomSchema, type Bom } from '@/domain/bom/schema';
import { BOM_SEED } from '@/data/seeds/bom.seed';

/**
 * BOM Repository — header(items·revisions 임베드) 캡슐화.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 */
const COLL = 'boms';

let memory: Bom[] = BOM_SEED.map((b) => bomSchema.parse(b));

export const bomRepo = {
  async list(): Promise<Bom[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      return snap.docs.map((d) => bomSchema.parse(d.data()));
    }
    return memory;
  },

  async save(bom: Bom): Promise<void> {
    const valid = bomSchema.parse(bom);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.code), valid);
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
