import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { jobTitleSchema, type JobTitle } from '@/domain/jobTitle/schema';
import { JOB_TITLE_SEED } from '@/data/seeds/jobTitle.seed';

/**
 * 직책 Repository — Firestore 접근을 캡슐화하고 인메모리 폴백을 지원합니다.
 */
const COLL = 'jobTitles';
let memory: JobTitle[] = JOB_TITLE_SEED.map((j) => jobTitleSchema.parse(j));

export const jobTitleRepo = {
  async list(): Promise<JobTitle[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      return snap.docs.map((d) => jobTitleSchema.parse(d.data()));
    }
    return memory;
  },

  async get(id: string): Promise<JobTitle | null> {
    const rows = await this.list();
    return rows.find((j) => j.id === id) ?? null;
  },

  async save(item: JobTitle): Promise<void> {
    const valid = jobTitleSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), valid);
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(id: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, id));
      return;
    }
    memory = memory.filter((m) => m.id !== id);
  },
};
