import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { urgentOrderSchema, type UrgentOrder } from '@/domain/urgentOrder/schema';
import { URGENT_ORDER_SEED } from '@/data/seeds/urgentOrder.seed';

/**
 * 긴급오더 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'urgentOrders';

export interface UrgentOrderFilter {
  type?: string;
  state?: string;
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: UrgentOrder[] = URGENT_ORDER_SEED.map((it) => urgentOrderSchema.parse(it));

function applyFilter(rows: UrgentOrder[], f?: UrgentOrderFilter): UrgentOrder[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      (!f.type || it.type === f.type) &&
      (!f.state || it.state === f.state) &&
      (!kw || it.no.toLowerCase().includes(kw) || it.name.toLowerCase().includes(kw)),
  );
}

export const urgentOrderRepo = {
  /** 전체 조회 + 클라이언트 필터(로그 규모상 적합). */
  async list(filter?: UrgentOrderFilter): Promise<UrgentOrder[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => urgentOrderSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(no: string): Promise<UrgentOrder | null> {
    const rows = await this.list();
    return rows.find((it) => it.no === no) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = 지시번호(no). */
  async save(item: UrgentOrder): Promise<void> {
    const valid = urgentOrderSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.no), valid);
      return;
    }
    const i = memory.findIndex((m) => m.no === valid.no);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
