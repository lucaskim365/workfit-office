import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { agingStockSchema, type AgingStock } from '@/domain/agingStock/schema';
import { AGING_STOCK_SEED } from '@/data/seeds/agingStock.seed';

/**
 * 장기재고/유효기간 Repository — Firestore 접근을 캡슐화하는 유일한 계층.
 * domain·features·UI 는 이 파일을 통해서만 데이터에 접근한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1: DB 교체 시 이 파일만 재작성)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade. 조회전용 마스터.
 */
const COLL = 'agingStock';

export interface AgingStockFilter {
  q?: string;
}

/** 미설정 시 세션 내 변경을 보존하는 인메모리 폴백 저장소. */
let memory: AgingStock[] = AGING_STOCK_SEED.map((it) => agingStockSchema.parse(it));

function applyFilter(rows: AgingStock[], f?: AgingStockFilter): AgingStock[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (it) =>
      !kw ||
      it.lot.toLowerCase().includes(kw) ||
      it.code.toLowerCase().includes(kw) ||
      it.name.toLowerCase().includes(kw),
  );
}

export const agingStockRepo = {
  /** 전체 조회 + 클라이언트 필터(마스터 규모상 적합). */
  async list(filter?: AgingStockFilter): Promise<AgingStock[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => agingStockSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  async get(lot: string): Promise<AgingStock | null> {
    const rows = await this.list();
    return rows.find((it) => it.lot === lot) ?? null;
  },

  /** 등록/수정(upsert). 문서 ID = Lot 번호. */
  async save(item: AgingStock): Promise<void> {
    const valid = agingStockSchema.parse(item);
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.lot), valid);
      return;
    }
    const i = memory.findIndex((m) => m.lot === valid.lot);
    if (i >= 0) memory[i] = valid;
    else memory = [...memory, valid];
  },
};
