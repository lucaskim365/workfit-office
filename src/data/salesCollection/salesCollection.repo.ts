import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { salesCollectionSchema, type SalesCollection } from '@/domain/salesCollection/schema';
import { SALES_COLLECTION_SEED } from '@/data/seeds/salesCollection.seed';

/**
 * 수금 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'salesCollections';

export interface SalesCollectionFilter {
  method?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: SalesCollection[] = SALES_COLLECTION_SEED.map((it) => salesCollectionSchema.parse(it));

function applyFilter(rows: SalesCollection[], f?: SalesCollectionFilter): SalesCollection[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.method || it.method === f.method) &&
      (!kw || it.no.toLowerCase().includes(kw) || it.cust.toLowerCase().includes(kw)),
  );
}

export const salesCollectionRepo = {
  /** 전체 조회 + 클라이언트 필터(로그 규모상 적합). */
  async list(filter?: SalesCollectionFilter): Promise<SalesCollection[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => salesCollectionSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(no: string): Promise<SalesCollection | null> {
    const rows = await this.list();
    return rows.find((it) => it.no === no) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 수금번호(no). */
  async save(item: SalesCollection): Promise<void> {
    const valid = salesCollectionSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.no), valid);
      return;
    }
    const i = memory.findIndex((m) => m.no === valid.no);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },

  async remove(no: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, COLL, no));
      return;
    }
    memory = memory.filter((m) => m.no !== no);
  },
};
