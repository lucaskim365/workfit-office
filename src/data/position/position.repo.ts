import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { positionSchema, type Position } from '@/domain/position/schema';
import { POSITION_SEED } from '@/data/seeds/position.seed';

/**
 * 직급 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'positions';
let memory: Position[] = POSITION_SEED.map((p) => positionSchema.parse(p));

export const positionRepo = {
  async list(): Promise<Position[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      return snap.docs.map((d) => positionSchema.parse(d.data()));
    }
    return memory;
  },

  async get(id: string): Promise<Position | null> {
    const rows = await this.list();
    return rows.find((p) => p.id === id) ?? null;
  },

  async save(item: Position): Promise<void> {
    const valid = positionSchema.parse(item);
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
