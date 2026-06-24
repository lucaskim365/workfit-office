import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { equipCheckItemSchema, type EquipCheckItem } from '@/domain/equipCheckItem/schema';
import { EQUIP_CHECK_SEED } from '@/data/seeds/equipCheckItem.seed';

/**
 * 설비 점검항목 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 조회 마스터 — 설비 유형(type) 1개 = 1 도큐먼트. 문서 ID = type.
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'equipCheckItems';

export interface EquipCheckItemFilter {
  /** 설비 유형(PK) 직접 지정. */
  type?: string;
  /** 점검 항목명·부위 키워드 검색(임베드 행 매칭되는 도큐먼트만 반환). */
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: EquipCheckItem[] = EQUIP_CHECK_SEED.map((d) => equipCheckItemSchema.parse(d));

function applyFilter(rows: EquipCheckItem[], f?: EquipCheckItemFilter): EquipCheckItem[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (d) =>
      (!f.type || d.type === f.type) &&
      (!kw ||
        d.type.toLowerCase().includes(kw) ||
        d.items.some((x) => x.name.toLowerCase().includes(kw) || x.area.toLowerCase().includes(kw))),
  );
}

export const equipCheckItemRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: EquipCheckItemFilter): Promise<EquipCheckItem[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => equipCheckItemSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(type: string): Promise<EquipCheckItem | null> {
    const rows = await this.list();
    return rows.find((d) => d.type === type) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 설비 유형 type. */
  async save(item: EquipCheckItem): Promise<void> {
    const valid = equipCheckItemSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.type), valid);
      return;
    }
    const i = memory.findIndex((m) => m.type === valid.type);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
