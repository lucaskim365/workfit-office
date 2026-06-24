import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { stockMovementSchema, deriveStocks, type StockMovement, type Stock } from '@/domain/stock/schema';
import { STOCK_MOVEMENT_SEED, STOCK_SAFETY } from '@/data/seeds/stock.seed';

/**
 * 재고 Repository — 원장(stockMovements) 기록 + 현재고(stocks) 도출.
 * ★ 현재고는 절대 직접 수정하지 않는다. 원장에 movement를 append 하면 도출된다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 */
const COLL = 'stockMovements';

let ledger: StockMovement[] = STOCK_MOVEMENT_SEED.map((m) => stockMovementSchema.parse(m));

export interface MovementFilter {
  item?: string;
  warehouse?: string;
  type?: string;
}

const safetyOf = (item: string, warehouse: string) => STOCK_SAFETY[`${item}__${warehouse}`] ?? 0;

function applyFilter(rows: StockMovement[], f?: MovementFilter): StockMovement[] {
  if (!f) return rows;
  return rows.filter(
    (m) => (!f.item || m.item === f.item) && (!f.warehouse || m.warehouse === f.warehouse) && (!f.type || m.type === f.type),
  );
}

export const stockRepo = {
  /** 원장 조회(필터). */
  async listMovements(filter?: MovementFilter): Promise<StockMovement[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => stockMovementSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(ledger, filter);
  },

  /** 현재고 스냅샷 — 원장에서 도출. (운영 시 트리거가 유지하는 stocks 컬렉션과 동일 로직) */
  async getStocks(): Promise<Stock[]> {
    const movements = await this.listMovements();
    return deriveStocks(movements, safetyOf);
  },

  /** 재고 변동 기록 — 유일한 재고 변경 경로(원장 append). */
  async addMovement(m: Omit<StockMovement, 'id'> & { id?: string }): Promise<void> {
    const id = m.id ?? `MOV-${String(ledger.length + 1).padStart(4, '0')}`;
    const valid = stockMovementSchema.parse({ ...m, id });
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, COLL, valid.id), valid);
      return;
    }
    ledger = [...ledger, valid];
  },
};
