import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { decodeFromFirestore, encodeForFirestore } from '@/shared/lib/firestore-codec';
import { coaSchema, type Coa, type CoaDraft } from '@/domain/coa/schema';
import { canTransition } from '@/domain/coa/status';
import { yymmdd, formatCoaNo } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { COA_SEED } from '@/data/seeds/coa.seed';

/**
 * 출하 성적서(COA) Repository — 채번(counters) + 상태머신 전이를 강제.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'coaCertificates';

export interface CoaFilter {
  status?: string;
  q?: string;
}

let memory: Coa[] = COA_SEED.map((c) => coaSchema.parse(c));

function applyFilter(rows: Coa[], f?: CoaFilter): Coa[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (c) =>
      (!f.status || c.status === f.status) &&
      (!kw || c.no.toLowerCase().includes(kw) || c.name.includes(kw) || c.cust.includes(kw)),
  );
}

async function loadAll(): Promise<Coa[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => coaSchema.parse(decodeFromFirestore(d.data())));
  }
  return memory;
}

async function persist(c: Coa): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, c.no), encodeForFirestore(c));
    return;
  }
  const i = memory.findIndex((m) => m.no === c.no);
  if (i >= 0) memory[i] = c;
  else memory = [c, ...memory];
}

export const coaRepo = {
  async list(filter?: CoaFilter): Promise<Coa[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(no: string): Promise<Coa | null> {
    const rows = await loadAll();
    return rows.find((c) => c.no === no) ?? null;
  },

  /** 신규 발행 — COA-YYMMDD-NNN 채번 후 '발행대기' 상태로 생성. */
  async create(draft: CoaDraft, now: Date): Promise<Coa> {
    const dateKey = yymmdd(now);
    const seq = await counterRepo.next(`COA-${dateKey}`);
    const coa = coaSchema.parse({ ...draft, no: formatCoaNo(dateKey, seq), status: '발행대기' });
    await persist(coa);
    return coa;
  },

  async save(c: Coa): Promise<void> {
    await persist(coaSchema.parse(c));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(no: string, to: Coa['status']): Promise<void> {
    const cur = await this.get(no);
    if (!cur) throw new Error(`COA를 찾을 수 없습니다: ${no}`);
    if (!canTransition(cur.status, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.status} → ${to}`);
    }
    await persist({ ...cur, status: to });
  },
};
