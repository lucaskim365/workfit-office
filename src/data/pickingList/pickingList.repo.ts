import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { pickingListSchema, type PickingList } from '@/domain/pickingList/schema';
import { PICKING_LIST_SEED } from '@/data/seeds/pickingList.seed';

/**
 * 피킹 리스트 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * 조회전용 마스터. Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'pickingList';

export interface PickingListFilter {
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: PickingList[] = PICKING_LIST_SEED.map((it) => pickingListSchema.parse(it));

function applyFilter(rows: PickingList[], f?: PickingListFilter): PickingList[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) => !kw || it.code.toLowerCase().includes(kw) || it.lot.toLowerCase().includes(kw),
  );
}

export const pickingListRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: PickingListFilter): Promise<PickingList[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => pickingListSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(id: string): Promise<PickingList | null> {
    const rows = await this.list();
    return rows.find((it) => it.id === id) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = id. */
  async save(item: PickingList): Promise<void> {
    const valid = pickingListSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), valid);
      return;
    }
    const i = memory.findIndex((m) => m.id === valid.id);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
