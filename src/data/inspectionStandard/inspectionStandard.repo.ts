import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { inspectionStandardSchema, type InspectionStandard } from '@/domain/inspectionStandard/schema';
import { INSPECTION_STANDARD_SEED } from '@/data/seeds/inspectionStandard.seed';

/**
 * 검사기준 Repository — header(procs[].items[] 임베드) 캡슐화.
 * 문서 ID=제품code. ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 */
const COLL = 'inspectionStandards';

let memory: InspectionStandard[] = INSPECTION_STANDARD_SEED.map((s) => inspectionStandardSchema.parse(s));

export const inspectionStandardRepo = {
  async list(q?: string): Promise<InspectionStandard[]> {
    let rows: InspectionStandard[];
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      rows = snap.docs.map((d) => inspectionStandardSchema.parse(d.data()));
    } else {
      rows = memory;
    }
    if (q && q.trim()) {
      const kw = q.trim().toLowerCase();
      rows = rows.filter((r) => r.code.toLowerCase().includes(kw) || r.name.toLowerCase().includes(kw));
    }
    return rows;
  },

  async get(code: string): Promise<InspectionStandard | undefined> {
    const rows = await this.list();
    return rows.find((r) => r.code === code);
  },

  async save(std: InspectionStandard): Promise<void> {
    const valid = inspectionStandardSchema.parse(std);
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
