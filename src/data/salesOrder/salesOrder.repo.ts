import { salesOrderSchema, deliveryStatus, type SalesOrder } from '@/domain/salesOrder/schema';
import { counterRepo } from '@/data/counter/counter.repo';
import { SALES_ORDER_SEED } from '@/data/seeds/salesOrder.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 수주 Repository — header(lines 임베드) + 채번. 납품상태는 도출(도메인 함수).
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직·채번만 여기 유지.
 */
const backend = createCrudBackend<SalesOrder>({
  coll: 'salesOrders',
  parse: (raw) => {
    const p = salesOrderSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse salesOrder:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (o) => o.no,
  seed: SALES_ORDER_SEED.map((o) => salesOrderSchema.parse(o)),
  jsonFields: ['lines'],
});

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

export const salesOrderRepo = {
  async list(filter?: SoFilter): Promise<SalesOrder[]> {
    return applyFilter(await backend.loadAll(), filter);
  },

  /** 신규 수주 — counters 채널(SO-YYMM)에서 채번. */
  async create(draft: Omit<SalesOrder, 'no'>): Promise<SalesOrder> {
    const month = (draft.orderDate || '2026-06').replace(/-/g, '').slice(2, 6); // YYMM
    const seq = await counterRepo.next(`SO-${month}`);
    const order = salesOrderSchema.parse({ ...draft, no: `SO-${month}-${String(seq).padStart(3, '0')}` });
    await backend.save(order);
    return order;
  },

  /** 납품 기록 — 라인별 납품량 가산(납품상태는 자동 도출). 출하(shipments)에서 호출. */
  async recordDelivery(no: string, deliveries: Record<string, number>): Promise<void> {
    const o = (await this.list()).find((x) => x.no === no);
    if (!o) throw new Error(`수주 없음: ${no}`);
    const lines = o.lines.map((l) =>
      deliveries[l.code] ? { ...l, deliveredQty: Math.min(l.deliveredQty + deliveries[l.code], l.qty) } : l,
    );
    await backend.save(salesOrderSchema.parse({ ...o, lines }));
  },

  async save(o: SalesOrder): Promise<void> {
    await backend.save(salesOrderSchema.parse(o));
  },
};
