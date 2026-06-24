import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { oeeEquipmentSchema, type OeeEquipment } from '@/domain/oeeEquipment/schema';
import { OEE_EQUIPMENT_SEED } from '@/data/seeds/oeeEquipment.seed';

/**
 * 설비 OEE Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade. 조회전용 마스터.
 */
const COLL = 'oeeEquipments';

export interface OeeEquipmentFilter {
  st?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: OeeEquipment[] = OEE_EQUIPMENT_SEED.map((it) => oeeEquipmentSchema.parse(it));

function applyFilter(rows: OeeEquipment[], f?: OeeEquipmentFilter): OeeEquipment[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.st || it.st === f.st) &&
      (!kw || it.code.toLowerCase().includes(kw) || it.name.toLowerCase().includes(kw)),
  );
}

export const oeeEquipmentRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: OeeEquipmentFilter): Promise<OeeEquipment[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => oeeEquipmentSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(code: string): Promise<OeeEquipment | null> {
    const rows = await this.list();
    return rows.find((it) => it.code === code) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 설비 코드. */
  async save(item: OeeEquipment): Promise<void> {
    const valid = oeeEquipmentSchema.parse(item);
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
