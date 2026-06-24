import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { workOrderSchema, type WorkOrder, type WorkOrderDraft, type WoStatus } from '@/domain/workOrder/schema';
import { canTransition } from '@/domain/workOrder/status';
import { yymmdd, formatWoNo } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { WORK_ORDER_SEED } from '@/data/seeds/workOrder.seed';

/**
 * 작업지시 Repository — 채번(counters) + 상태머신 전이를 강제.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]])
 */
const COLL = 'workOrders';

let memory: WorkOrder[] = WORK_ORDER_SEED.map((w) => workOrderSchema.parse(w));

export interface WoFilter {
  line?: string;
  status?: string;
  q?: string;
}

function applyFilter(rows: WorkOrder[], f?: WoFilter): WorkOrder[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (w) =>
      (!f.line || w.line === f.line) &&
      (!f.status || w.status === f.status) &&
      (!kw || [w.no, w.code].some((v) => v.toLowerCase().includes(kw))),
  );
}

async function persist(wo: WorkOrder): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, wo.no), wo);
    return;
  }
  const i = memory.findIndex((m) => m.no === wo.no);
  if (i >= 0) memory[i] = wo;
  else memory = [wo, ...memory];
}

export const workOrderRepo = {
  async list(filter?: WoFilter): Promise<WorkOrder[]> {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(collection(db, COLL));
      const rows = snap.docs.map((d) => workOrderSchema.parse(d.data()));
      return applyFilter(rows, filter);
    }
    return applyFilter(memory, filter);
  },

  /** 신규 발행 — counters 채널에서 번호 채번, 상태 '대기'. */
  async create(draft: WorkOrderDraft): Promise<WorkOrder> {
    const dateKey = yymmdd(new Date());
    const seq = await counterRepo.next(`WO-${dateKey}`);
    const wo = workOrderSchema.parse({ ...draft, no: formatWoNo(dateKey, seq), status: '대기' });
    await persist(wo);
    return wo;
  },

  /** 상태 전이 — 상태머신 검증 후 저장. 불가 전이는 예외. */
  async transition(no: string, to: WoStatus, at: string): Promise<void> {
    const wo = (await this.list()).find((w) => w.no === no);
    if (!wo) throw new Error(`작업지시 없음: ${no}`);
    if (!canTransition(wo.status, to)) throw new Error(`전이 불가: ${wo.status} → ${to}`);
    const next: WorkOrder = { ...wo, status: to };
    if (to === '진행' && !next.start) next.start = at;
    if (to === '완료') next.end = at;
    await persist(workOrderSchema.parse(next));
  },

  async save(wo: WorkOrder): Promise<void> {
    await persist(workOrderSchema.parse(wo));
  },
};
