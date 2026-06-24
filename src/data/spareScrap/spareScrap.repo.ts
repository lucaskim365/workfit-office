import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { spareScrapSchema, type SpareScrap, type SpareScrapDraft } from '@/domain/spareScrap/schema';
import { canTransition } from '@/domain/spareScrap/status';
import { yymm, formatDocNo } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { SPARE_SCRAP_SEED } from '@/data/seeds/spareScrap.seed';

/**
 * 예비품 폐기·불용(SpareScrap) Repository — 채번(counters) + 상태머신 전이를 강제.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 * 문서 ID = no(DS-YYMM-NNN). 채번 전 항목은 no='–'(불용지정 단계) — code를 보조 키로 사용.
 */
const COLL = 'spareScraps';

export interface SpareScrapFilter {
  state?: string;
  reason?: string;
  q?: string;
}

let memory: SpareScrap[] = SPARE_SCRAP_SEED.map((s) => spareScrapSchema.parse(s));

function applyFilter(rows: SpareScrap[], f?: SpareScrapFilter): SpareScrap[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (s) =>
      (!f.state || s.state === f.state) &&
      (!f.reason || s.reason === f.reason) &&
      (!kw || s.no.toLowerCase().includes(kw) || s.name.includes(kw) || s.code.toLowerCase().includes(kw)),
  );
}

async function loadAll(): Promise<SpareScrap[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => spareScrapSchema.parse(d.data()));
  }
  return memory;
}

async function persist(s: SpareScrap): Promise<void> {
  if (isFirebaseConfigured && db) {
    // 채번된 항목만 문서 ID로 저장(no='–'는 미채번 임시 항목).
    await setDoc(doc(db, COLL, s.no), s);
    return;
  }
  const i = memory.findIndex((m) => m.no === s.no && m.code === s.code);
  if (i >= 0) memory[i] = s;
  else memory = [s, ...memory];
}

export const spareScrapRepo = {
  async list(filter?: SpareScrapFilter): Promise<SpareScrap[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(no: string): Promise<SpareScrap | null> {
    const rows = await loadAll();
    return rows.find((s) => s.no === no) ?? null;
  },

  /** 신규 불용 지정 — DS-YYMM-NNN 채번 후 '불용지정' 상태로 생성. */
  async create(draft: SpareScrapDraft, now: Date): Promise<SpareScrap> {
    const dateKey = yymm(now);
    const seq = await counterRepo.next(`DS-${dateKey}`);
    const row = spareScrapSchema.parse({
      ...draft,
      no: formatDocNo('DS', dateKey, seq),
      state: '불용지정',
    });
    await persist(row);
    return row;
  },

  /** 등록/수정(upsert). */
  async save(s: SpareScrap): Promise<void> {
    await persist(spareScrapSchema.parse(s));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(no: string, to: SpareScrap['state']): Promise<void> {
    const cur = await this.get(no);
    if (!cur) throw new Error(`폐기·불용 항목을 찾을 수 없습니다: ${no}`);
    if (!canTransition(cur.state, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.state} → ${to}`);
    }
    await persist({ ...cur, state: to });
  },
};
