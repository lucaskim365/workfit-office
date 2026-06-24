import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { workCenterSchema, type WorkCenter } from '@/domain/workCenter/schema';
import { WORK_CENTER_SEED } from '@/data/seeds/workCenter.seed';

/**
 * 작업장 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 */
const COLL = 'workCenters';

let memory: WorkCenter[] = WORK_CENTER_SEED.map((w) => workCenterSchema.parse(w));

export const workCenterRepo = {
  async list(): Promise<WorkCenter[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      return snap.docs.map((d) => workCenterSchema.parse(d.data()));
    }
    return memory;
  },

  async save(wc: WorkCenter): Promise<void> {
    const valid = workCenterSchema.parse(wc);
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
