import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { routingSchema, type Routing } from '@/domain/routing/schema';
import { ROUTING_SEED } from '@/data/seeds/routing.seed';

/**
 * 라우팅 Repository — header(steps 임베드) 캡슐화.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 */
const COLL = 'routings';

let memory: Routing[] = ROUTING_SEED.map((r) => routingSchema.parse(r));

export const routingRepo = {
  async list(): Promise<Routing[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      return snap.docs.map((d) => routingSchema.parse(d.data()));
    }
    return memory;
  },

  async save(routing: Routing): Promise<void> {
    const valid = routingSchema.parse(routing);
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
