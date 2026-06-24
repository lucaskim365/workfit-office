import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import {
  maintOutsourcingSchema,
  type MaintOutsourcing,
  type MaintOutsourcingDraft,
} from '@/domain/maintOutsourcing/schema';
import { canTransition } from '@/domain/maintOutsourcing/status';
import { yymm, formatDocNo } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { MAINT_OUTSOURCING_SEED } from '@/data/seeds/maintOutsourcing.seed';

/**
 * 보전 외주 Repository — 채번(counters) + 상태머신 전이를 강제.
 * ([[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'maintOutsourcing';

export interface OsFilter {
  state?: string;
  q?: string;
}

let memory: MaintOutsourcing[] = MAINT_OUTSOURCING_SEED.map((m) => maintOutsourcingSchema.parse(m));

function applyFilter(rows: MaintOutsourcing[], f?: OsFilter): MaintOutsourcing[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (m) =>
      (!f.state || m.state === f.state) &&
      (!kw || m.no.toLowerCase().includes(kw) || m.eq.includes(kw) || m.vendor.includes(kw)),
  );
}

async function loadAll(): Promise<MaintOutsourcing[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => maintOutsourcingSchema.parse(d.data()));
  }
  return memory;
}

async function persist(m: MaintOutsourcing): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, m.no), m);
    return;
  }
  const i = memory.findIndex((x) => x.no === m.no);
  if (i >= 0) memory[i] = m;
  else memory = [m, ...memory];
}

export const maintOutsourcingRepo = {
  async list(filter?: OsFilter): Promise<MaintOutsourcing[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(no: string): Promise<MaintOutsourcing | null> {
    const rows = await loadAll();
    return rows.find((m) => m.no === no) ?? null;
  },

  /** 신규 의뢰 — OS-YYMM-NNN 채번 후 '접수' 상태로 생성. */
  async create(draft: MaintOutsourcingDraft, now: Date): Promise<MaintOutsourcing> {
    const monthKey = yymm(now);
    const seq = await counterRepo.next(`OS-${monthKey}`);
    const row = maintOutsourcingSchema.parse({
      ...draft,
      no: formatDocNo('OS', monthKey, seq),
      state: '접수',
    });
    await persist(row);
    return row;
  },

  /** 등록/수정(upsert). */
  async save(m: MaintOutsourcing): Promise<void> {
    await persist(maintOutsourcingSchema.parse(m));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(no: string, to: MaintOutsourcing['state']): Promise<void> {
    const cur = await this.get(no);
    if (!cur) throw new Error(`외주 의뢰를 찾을 수 없습니다: ${no}`);
    if (!canTransition(cur.state, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.state} → ${to}`);
    }
    await persist({ ...cur, state: to });
  },
};
