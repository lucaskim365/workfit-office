import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { salesOrderSchema, deliveryStatus, type SalesOrder } from '@/domain/salesOrder/schema';
import { counterRepo } from '@/data/counter/counter.repo';
import { SALES_ORDER_SEED } from '@/data/seeds/salesOrder.seed';

/**
 * 수주 Repository — header(lines 임베드) + 채번. 납품상태는 도출(도메인 함수).
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 */
const COLL = 'salesOrders';

let memory: SalesOrder[] = SALES_ORDER_SEED.map((o) => salesOrderSchema.parse(o));

export interface SoFilter {
  customer?: string;
  status?: string; // 납품상태(도출값) 필터
  q?: string;
}

function applyFilter(rows: SalesOrder[], f?: SoFilter): SalesOrder[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (o) =>
      (!f.customer || o.customer === f.customer) &&
      (!f.status || deliveryStatus(o) === f.status) &&
      (!kw || [o.no, o.customer].some((v) => v.toLowerCase().includes(kw))),
  );
}

async function persist(o: SalesOrder): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, o.no), o);
    return;
  }
  const i = memory.findIndex((m) => m.no === o.no);
  if (i >= 0) memory[i] = o;
  else memory = [o, ...memory];
}

export const salesOrderRepo = {
  async list(filter?: SoFilter): Promise<SalesOrder[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => salesOrderSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  /** 신규 수주 — counters 채널(SO-YYMM)에서 채번. */
  async create(draft: Omit<SalesOrder, 'no'>): Promise<SalesOrder> {
    const month = (draft.orderDate || '2026-06').replace(/-/g, '').slice(2, 6); // YYMM
    const seq = await counterRepo.next(`SO-${month}`);
    const order = salesOrderSchema.parse({ ...draft, no: `SO-${month}-${String(seq).padStart(3, '0')}` });
    await persist(order);
    return order;
  },

  /** 납품 기록 — 라인별 납품량 가산(납품상태는 자동 도출). 출하(shipments)에서 호출. */
  async recordDelivery(no: string, deliveries: Record<string, number>): Promise<void> {
    const o = (await this.list()).find((x) => x.no === no);
    if (!o) throw new Error(`수주 없음: ${no}`);
    const lines = o.lines.map((l) =>
      deliveries[l.code] ? { ...l, deliveredQty: Math.min(l.deliveredQty + deliveries[l.code], l.qty) } : l,
    );
    await persist(salesOrderSchema.parse({ ...o, lines }));
  },

  async save(o: SalesOrder): Promise<void> {
    await persist(salesOrderSchema.parse(o));
  },
};
