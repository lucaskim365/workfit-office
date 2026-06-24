import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import {
  reworkOrderSchema,
  type ReworkOrder,
  type ReworkOrderDraft,
} from '@/domain/reworkOrder/schema';
import { canTransition } from '@/domain/reworkOrder/status';
import { yymmdd, formatReworkNo } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { REWORK_ORDER_SEED } from '@/data/seeds/reworkOrder.seed';

/**
 * 재작업·폐기 지시 Repository — 채번(counters) + 상태머신 전이를 강제.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'reworkOrders';

export interface ReworkFilter {
  type?: string;
  status?: string;
  q?: string;
}

let memory: ReworkOrder[] = REWORK_ORDER_SEED.map((o) => reworkOrderSchema.parse(o));

function applyFilter(rows: ReworkOrder[], f?: ReworkFilter): ReworkOrder[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (o) =>
      (!f.type || o.type === f.type) &&
      (!f.status || o.status === f.status) &&
      (!kw || o.no.toLowerCase().includes(kw) || o.name.includes(kw) || o.code.toLowerCase().includes(kw)),
  );
}

async function loadAll(): Promise<ReworkOrder[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => reworkOrderSchema.parse(d.data()));
  }
  return memory;
}

async function persist(o: ReworkOrder): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, o.no), o);
    return;
  }
  const i = memory.findIndex((m) => m.no === o.no);
  if (i >= 0) memory[i] = o;
  else memory = [o, ...memory];
}

export const reworkOrderRepo = {
  async list(filter?: ReworkFilter): Promise<ReworkOrder[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(no: string): Promise<ReworkOrder | null> {
    const rows = await loadAll();
    return rows.find((o) => o.no === no) ?? null;
  },

  /** 신규 발행 — type에 따라 RW-/SC-YYMMDD-NNN 채번 후 시작 상태로 생성. */
  async create(draft: ReworkOrderDraft, now: Date): Promise<ReworkOrder> {
    const dateKey = yymmdd(now);
    const prefix = draft.type === '폐기' ? 'SC' : 'RW';
    const seq = await counterRepo.next(`${prefix}-${dateKey}`);
    // 재작업은 '지시'부터, 폐기는 '승인대기'부터 시작.
    const status = draft.type === '폐기' ? '승인대기' : '지시';
    const order = reworkOrderSchema.parse({
      ...draft,
      no: formatReworkNo(prefix, dateKey, seq),
      status,
    });
    await persist(order);
    return order;
  },

  /** 등록/수정(upsert). */
  async save(o: ReworkOrder): Promise<void> {
    await persist(reworkOrderSchema.parse(o));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(no: string, to: ReworkOrder['status']): Promise<void> {
    const cur = await this.get(no);
    if (!cur) throw new Error(`재작업·폐기 지시를 찾을 수 없습니다: ${no}`);
    if (!canTransition(cur.status, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.status} → ${to}`);
    }
    await persist({ ...cur, status: to });
  },
};
