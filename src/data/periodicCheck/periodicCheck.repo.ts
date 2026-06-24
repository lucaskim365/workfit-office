import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import {
  periodicCheckSchema,
  type PeriodicCheck,
  type PeriodicCheckDraft,
} from '@/domain/periodicCheck/schema';
import { canTransition } from '@/domain/periodicCheck/status';
import { yymm, formatDocNo } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { PERIODIC_CHECK_SEED } from '@/data/seeds/periodicCheck.seed';

/**
 * 정기 점검(Periodic Check) Repository — 채번(counters) + 상태머신 전이를 강제.
 * ([[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'periodicChecks';

export interface PeriodicCheckFilter {
  /** 판정(합격·조건부·불합격) 필터. */
  result?: string;
  q?: string;
}

let memory: PeriodicCheck[] = PERIODIC_CHECK_SEED.map((p) => periodicCheckSchema.parse(p));

function applyFilter(rows: PeriodicCheck[], f?: PeriodicCheckFilter): PeriodicCheck[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (p) =>
      (!f.result || p.result === f.result) &&
      (!kw || p.no.toLowerCase().includes(kw) || p.eq.includes(kw) || p.worker.includes(kw)),
  );
}

async function loadAll(): Promise<PeriodicCheck[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => periodicCheckSchema.parse(d.data()));
  }
  return memory;
}

async function persist(p: PeriodicCheck): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, p.no), p);
    return;
  }
  const i = memory.findIndex((m) => m.no === p.no);
  if (i >= 0) memory[i] = p;
  else memory = [p, ...memory];
}

export const periodicCheckRepo = {
  async list(filter?: PeriodicCheckFilter): Promise<PeriodicCheck[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(no: string): Promise<PeriodicCheck | null> {
    const rows = await loadAll();
    return rows.find((p) => p.no === no) ?? null;
  },

  /** 신규 등록 — PC-YYMM-NNN(월단위) 채번 후 '진행' 상태로 생성. */
  async create(draft: PeriodicCheckDraft, now: Date): Promise<PeriodicCheck> {
    const dateKey = yymm(now);
    const seq = await counterRepo.next(`PC-${dateKey}`);
    const pc = periodicCheckSchema.parse({
      ...draft,
      no: formatDocNo('PC', dateKey, seq),
      status: '진행',
    });
    await persist(pc);
    return pc;
  },

  /** 등록/수정(upsert). */
  async save(p: PeriodicCheck): Promise<void> {
    await persist(periodicCheckSchema.parse(p));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(no: string, to: PeriodicCheck['status']): Promise<void> {
    const cur = await this.get(no);
    if (!cur) throw new Error(`정기 점검을 찾을 수 없습니다: ${no}`);
    if (!canTransition(cur.status, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.status} → ${to}`);
    }
    await persist({ ...cur, status: to });
  },
};
