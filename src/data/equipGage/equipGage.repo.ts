import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { equipGageSchema, type EquipGage } from '@/domain/equipGage/schema';
import { EQUIP_GAGE_SEED } from '@/data/seeds/equipGage.seed';

/**
 * 설비 계측기 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'equipGages';

export interface EquipGageFilter {
  cat?: string;
  state?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: EquipGage[] = EQUIP_GAGE_SEED.map((it) => equipGageSchema.parse(it));

function applyFilter(rows: EquipGage[], f?: EquipGageFilter): EquipGage[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (g) =>
      (!f.cat || g.cat === f.cat) &&
      (!f.state || g.state === f.state) &&
      (!kw ||
        g.sn.toLowerCase().includes(kw) ||
        g.name.toLowerCase().includes(kw) ||
        g.model.toLowerCase().includes(kw)),
  );
}

export const equipGageRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: EquipGageFilter): Promise<EquipGage[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => equipGageSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(sn: string): Promise<EquipGage | null> {
    const rows = await this.list();
    return rows.find((g) => g.sn === sn) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 시리얼 번호. */
  async save(gage: EquipGage): Promise<void> {
    const valid = equipGageSchema.parse(gage);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.sn), valid);
      return;
    }
    const i = memory.findIndex((m) => m.sn === valid.sn);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(sn: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, sn));
      return;
    }
    memory = memory.filter((m) => m.sn !== sn);
  },
};
