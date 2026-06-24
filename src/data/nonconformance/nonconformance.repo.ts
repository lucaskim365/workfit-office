import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import {
  nonconformanceSchema,
  type Nonconformance,
  type NonconformanceDraft,
} from '@/domain/nonconformance/schema';
import { canTransition } from '@/domain/nonconformance/status';
import { yymmdd, formatNcrNo } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { NONCONFORMANCE_SEED } from '@/data/seeds/nonconformance.seed';

/**
 * 부적합(NCR) Repository — 채번(counters) + 상태머신 전이를 강제.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'nonconformances';

export interface NcrFilter {
  src?: string;
  status?: string;
  q?: string;
}

let memory: Nonconformance[] = NONCONFORMANCE_SEED.map((n) => nonconformanceSchema.parse(n));

function applyFilter(rows: Nonconformance[], f?: NcrFilter): Nonconformance[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (n) =>
      (!f.src || n.src === f.src) &&
      (!f.status || n.status === f.status) &&
      (!kw || n.no.toLowerCase().includes(kw) || n.name.includes(kw) || n.code.toLowerCase().includes(kw)),
  );
}

async function loadAll(): Promise<Nonconformance[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => nonconformanceSchema.parse(d.data()));
  }
  return memory;
}

async function persist(n: Nonconformance): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, n.no), n);
    return;
  }
  const i = memory.findIndex((m) => m.no === n.no);
  if (i >= 0) memory[i] = n;
  else memory = [n, ...memory];
}

export const nonconformanceRepo = {
  async list(filter?: NcrFilter): Promise<Nonconformance[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(no: string): Promise<Nonconformance | null> {
    const rows = await loadAll();
    return rows.find((n) => n.no === no) ?? null;
  },

  /** 신규 발행 — NCR-YYMMDD-NNN 채번 후 '발행' 상태로 생성. */
  async create(draft: NonconformanceDraft, now: Date): Promise<Nonconformance> {
    const dateKey = yymmdd(now);
    const seq = await counterRepo.next(`NCR-${dateKey}`);
    const ncr = nonconformanceSchema.parse({
      ...draft,
      no: formatNcrNo(dateKey, seq),
      status: '발행',
    });
    await persist(ncr);
    return ncr;
  },

  /** 등록/수정(upsert). */
  async save(n: Nonconformance): Promise<void> {
    await persist(nonconformanceSchema.parse(n));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(no: string, to: Nonconformance['status']): Promise<void> {
    const cur = await this.get(no);
    if (!cur) throw new Error(`NCR을 찾을 수 없습니다: ${no}`);
    if (!canTransition(cur.status, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.status} → ${to}`);
    }
    await persist({ ...cur, status: to });
  },
};
