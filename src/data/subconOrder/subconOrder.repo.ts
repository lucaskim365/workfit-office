import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import {
  subconOrderSchema,
  type SubconOrder,
  type SubconOrderDraft,
} from '@/domain/subconOrder/schema';
import { canTransition } from '@/domain/subconOrder/status';
import { yymm, formatDocNo } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { SUBCON_ORDER_SEED } from '@/data/seeds/subconOrder.seed';

/**
 * 외주 발주 Repository — 채번(counters) + 상태머신 전이를 강제.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'subconOrders';

export interface SubconOrderFilter {
  state?: string;
  q?: string;
}

let memory: SubconOrder[] = SUBCON_ORDER_SEED.map((o) => subconOrderSchema.parse(o));

function applyFilter(rows: SubconOrder[], f?: SubconOrderFilter): SubconOrder[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (o) =>
      (!f.state || o.status === f.state) &&
      (!kw ||
        o.no.toLowerCase().includes(kw) ||
        o.name.includes(kw) ||
        o.vendor.includes(kw) ||
        o.code.toLowerCase().includes(kw)),
  );
}

async function loadAll(): Promise<SubconOrder[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => subconOrderSchema.parse(d.data()));
  }
  return memory;
}

async function persist(o: SubconOrder): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, o.no), o);
    return;
  }
  const i = memory.findIndex((m) => m.no === o.no);
  if (i >= 0) memory[i] = o;
  else memory = [o, ...memory];
}

export const subconOrderRepo = {
  async list(filter?: SubconOrderFilter): Promise<SubconOrder[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(no: string): Promise<SubconOrder | null> {
    const rows = await loadAll();
    return rows.find((o) => o.no === no) ?? null;
  },

  /** 신규 발행 — SC-YYMM-NNN 채번 후 '지시' 상태로 생성. */
  async create(draft: SubconOrderDraft, now: Date): Promise<SubconOrder> {
    const dateKey = yymm(now);
    const seq = await counterRepo.next(`SC-${dateKey}`);
    const order = subconOrderSchema.parse({
      ...draft,
      no: formatDocNo('SC', dateKey, seq),
      status: '지시',
    });
    await persist(order);
    return order;
  },

  /** 등록/수정(upsert). */
  async save(o: SubconOrder): Promise<void> {
    await persist(subconOrderSchema.parse(o));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(no: string, to: SubconOrder['status']): Promise<void> {
    const cur = await this.get(no);
    if (!cur) throw new Error(`외주 발주를 찾을 수 없습니다: ${no}`);
    if (!canTransition(cur.status, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.status} → ${to}`);
    }
    await persist({ ...cur, status: to });
  },
};
