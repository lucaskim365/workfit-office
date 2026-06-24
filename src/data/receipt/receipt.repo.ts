import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { receiptSchema, receiptStatus, type Receipt } from '@/domain/receipt/schema';
import { RECEIPT_SEED } from '@/data/seeds/receipt.seed';

/**
 * 입고 Repository — PO 대비 입고 기록. 재고 반영은 services/receiving.service.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 */
const COLL = 'receipts';

let memory: Receipt[] = RECEIPT_SEED.map((r) => receiptSchema.parse(r));

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

async function persist(r: Receipt): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, r.po), r);
    return;
  }
  const i = memory.findIndex((m) => m.po === r.po);
  if (i >= 0) memory[i] = r;
  else memory = [r, ...memory];
}

export const receiptRepo = {
  async list(filter?: ReceiptFilter): Promise<Receipt[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => receiptSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
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
    await persist(receiptSchema.parse({ ...r, recvQty: r.recvQty + applied }));
    return applied;
  },
};
