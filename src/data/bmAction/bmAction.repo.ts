import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { bmActionSchema, type BmAction, type BmActionDraft } from '@/domain/bmAction/schema';
import { canTransition } from '@/domain/bmAction/status';
import { yymm, formatDocNo } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { BM_ACTION_SEED } from '@/data/seeds/bmAction.seed';

/**
 * 사후보전(BM) Repository — 채번(counters) + 상태머신 전이를 강제.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'bmActions';

export interface BmFilter {
  state?: string;
  sev?: string;
  q?: string;
}

let memory: BmAction[] = BM_ACTION_SEED.map((b) => bmActionSchema.parse(b));

function applyFilter(rows: BmAction[], f?: BmFilter): BmAction[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (b) =>
      (!f.state || b.state === f.state) &&
      (!f.sev || b.sev === f.sev) &&
      (!kw || b.no.toLowerCase().includes(kw) || b.eq.includes(kw) || b.sym.includes(kw)),
  );
}

async function loadAll(): Promise<BmAction[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => bmActionSchema.parse(d.data()));
  }
  return memory;
}

async function persist(b: BmAction): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, b.no), b);
    return;
  }
  const i = memory.findIndex((m) => m.no === b.no);
  if (i >= 0) memory[i] = b;
  else memory = [b, ...memory];
}

export const bmActionRepo = {
  async list(filter?: BmFilter): Promise<BmAction[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(no: string): Promise<BmAction | null> {
    const rows = await loadAll();
    return rows.find((b) => b.no === no) ?? null;
  },

  /** 신규 접수 — BM-YYMM-NNN 채번 후 '접수' 상태로 생성. */
  async create(draft: BmActionDraft, now: Date): Promise<BmAction> {
    const monthKey = yymm(now);
    const seq = await counterRepo.next(`BM-${monthKey}`);
    const bm = bmActionSchema.parse({
      ...draft,
      no: formatDocNo('BM', monthKey, seq),
      state: '접수',
    });
    await persist(bm);
    return bm;
  },

  /** 등록/수정(upsert). */
  async save(b: BmAction): Promise<void> {
    await persist(bmActionSchema.parse(b));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(no: string, to: BmAction['state']): Promise<void> {
    const cur = await this.get(no);
    if (!cur) throw new Error(`BM 조치를 찾을 수 없습니다: ${no}`);
    if (!canTransition(cur.state, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.state} → ${to}`);
    }
    await persist({ ...cur, state: to });
  },
};
