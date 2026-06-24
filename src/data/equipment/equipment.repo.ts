import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { equipmentSchema, type Equipment } from '@/domain/equipment/schema';
import { EQUIPMENT_SEED } from '@/data/seeds/equipment.seed';

/**
 * 설비 마스터 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * 설비관리 모듈의 정본 데이터원. ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'equipments';

export interface EquipmentFilter {
  type?: string;
  line?: string;
  state?: string;
  use?: string;
  q?: string;
}

let memory: Equipment[] = EQUIPMENT_SEED.map((e) => equipmentSchema.parse(e));

function applyFilter(rows: Equipment[], f?: EquipmentFilter): Equipment[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (e) =>
      (!f.type || e.type === f.type) &&
      (!f.line || e.line === f.line) &&
      (!f.state || e.state === f.state) &&
      (!f.use || e.use === f.use) &&
      (!kw || e.code.toLowerCase().includes(kw) || e.name.includes(kw)),
  );
}

export const equipmentRepo = {
  async list(filter?: EquipmentFilter): Promise<Equipment[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => equipmentSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(code: string): Promise<Equipment | null> {
    const rows = await this.list();
    return rows.find((e) => e.code === code) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 설비코드. */
  async save(equip: Equipment): Promise<void> {
    const valid = equipmentSchema.parse(equip);
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
