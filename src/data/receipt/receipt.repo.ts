import { receiptSchema, receiptStatus, type Receipt } from '@/domain/receipt/schema';
import { RECEIPT_SEED } from '@/data/seeds/receipt.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';

/**
 * 입고 Repository — PO 대비 입고 기록. 재고 반영은 services/receiving.service.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임. 파생 로직만 여기 유지.
 */
const backend = createCrudBackend<Receipt>({
  coll: 'receipts',
  parse: (raw) => {
    const p = receiptSchema.safeParse(raw);
    if (!p.success) {
      console.error('Failed to parse receipt:', p.error);
      return null;
    }
    return p.data;
  },
  idOf: (r) => r.po,
  seed: RECEIPT_SEED.map((r) => receiptSchema.parse(r)),
});

export interface ReceiptFilter {
  vendor?: string;
  status?: string; // 도출값 필터
  q?: string;
}

function applyFilter(rows: Receipt[], f?: ReceiptFilter): Receipt[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (r) =>
      (!f.vendor || r.vendor === f.vendor) &&
      (!f.status || receiptStatus(r) === f.status) &&
      (!kw || [r.po, r.item].some((v) => v.toLowerCase().includes(kw))),
  );
}

export const receiptRepo = {
  async list(filter?: ReceiptFilter): Promise<Receipt[]> {
    return applyFilter(await backend.loadAll(), filter);
  },

  async get(po: string): Promise<Receipt | null> {
    return (await this.list()).find((r) => r.po === po) ?? null;
  },

  /** 입고수량 가산(PO수량 상한). 입고상태는 자동 도출. 재고 반영은 service가 담당. */
  async addReceived(po: string, qty: number): Promise<number> {
    const r = await this.get(po);
    if (!r) throw new Error(`입고 PO 없음: ${po}`);
    const applied = Math.min(qty, r.poQty - r.recvQty);
    if (applied <= 0) return 0;
    await backend.save(receiptSchema.parse({ ...r, recvQty: r.recvQty + applied }));
    return applied;
  },
};
