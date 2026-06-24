import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { decodeFromFirestore, encodeForFirestore } from '@/shared/lib/firestore-codec';
import { equipmentSpecSchema, type EquipmentSpec } from '@/domain/equipmentSpec/schema';
import { EQUIPMENT_SPEC_SEED } from '@/data/seeds/equipmentSpec.seed';

/**
 * 설비 제원·스펙 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * 조회전용 마스터(type별 1 도큐먼트). ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'equipmentSpecs';

export interface EquipmentSpecFilter {
  q?: string;
}

let memory: EquipmentSpec[] = EQUIPMENT_SPEC_SEED.map((s) => equipmentSpecSchema.parse(s));

function applyFilter(rows: EquipmentSpec[], f?: EquipmentSpecFilter): EquipmentSpec[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (s) => !kw || s.type.toLowerCase().includes(kw) || s.name.toLowerCase().includes(kw),
  );
}

export const equipmentSpecRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: EquipmentSpecFilter): Promise<EquipmentSpec[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => equipmentSpecSchema.parse(decodeFromFirestore(d.data())));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(type: string): Promise<EquipmentSpec | null> {
    const rows = await this.list();
    return rows.find((s) => s.type === type) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 설비 유형(type). */
  async save(spec: EquipmentSpec): Promise<void> {
    const valid = equipmentSpecSchema.parse(spec);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.type), encodeForFirestore(valid));
      return;
    }
    const i = memory.findIndex((m) => m.type === valid.type);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
