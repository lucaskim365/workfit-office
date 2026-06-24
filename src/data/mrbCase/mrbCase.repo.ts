import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { mrbCaseSchema, type MrbCase, type MrbCaseDraft } from '@/domain/mrbCase/schema';
import { canTransition } from '@/domain/mrbCase/status';
import { yymmdd, formatMrbNo } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { MRB_CASE_SEED } from '@/data/seeds/mrbCase.seed';

/**
 * MRB 부적합 심의 Repository — 채번(counters) + 상태머신 전이를 강제.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'mrbCases';

export interface MrbFilter {
  status?: string;
  q?: string;
}

let memory: MrbCase[] = MRB_CASE_SEED.map((c) => mrbCaseSchema.parse(c));

function applyFilter(rows: MrbCase[], f?: MrbFilter): MrbCase[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (c) =>
      (!f.status || c.status === f.status) &&
      (!kw ||
        c.no.toLowerCase().includes(kw) ||
        c.name.includes(kw) ||
        c.code.toLowerCase().includes(kw) ||
        c.ncr.toLowerCase().includes(kw)),
  );
}

async function loadAll(): Promise<MrbCase[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => mrbCaseSchema.parse(d.data()));
  }
  return memory;
}

async function persist(c: MrbCase): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, c.no), c);
    return;
  }
  const i = memory.findIndex((m) => m.no === c.no);
  if (i >= 0) memory[i] = c;
  else memory = [c, ...memory];
}

export const mrbCaseRepo = {
  async list(filter?: MrbFilter): Promise<MrbCase[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(no: string): Promise<MrbCase | null> {
    const rows = await loadAll();
    return rows.find((c) => c.no === no) ?? null;
  },

  /** 신규 안건 상정 — MRB-YYMMDD-NNN 채번 후 '심의대기' 상태로 생성. */
  async create(draft: MrbCaseDraft, now: Date): Promise<MrbCase> {
    const dateKey = yymmdd(now);
    const seq = await counterRepo.next(`MRB-${dateKey}`);
    const mrb = mrbCaseSchema.parse({
      ...draft,
      no: formatMrbNo(dateKey, seq),
      status: '심의대기',
    });
    await persist(mrb);
    return mrb;
  },

  /** 등록/수정(upsert). */
  async save(c: MrbCase): Promise<void> {
    await persist(mrbCaseSchema.parse(c));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(no: string, to: MrbCase['status']): Promise<void> {
    const cur = await this.get(no);
    if (!cur) throw new Error(`MRB 안건을 찾을 수 없습니다: ${no}`);
    if (!canTransition(cur.status, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.status} → ${to}`);
    }
    await persist({ ...cur, status: to });
  },
};
