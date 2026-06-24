import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { decodeFromFirestore, encodeForFirestore } from '@/shared/lib/firestore-codec';
import { capaSchema, type Capa, type CapaDraft } from '@/domain/capa/schema';
import { canTransition } from '@/domain/capa/status';
import { yymmdd, formatCapaNo } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { CAPA_SEED } from '@/data/seeds/capa.seed';

/**
 * 시정·예방조치(CAPA) Repository — 채번(counters) + 상태머신 전이를 강제.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'capaActions';

export interface CapaFilter {
  src?: string;
  status?: string;
  q?: string;
}

let memory: Capa[] = CAPA_SEED.map((c) => capaSchema.parse(c));

function applyFilter(rows: Capa[], f?: CapaFilter): Capa[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (c) =>
      (!f.src || c.src === f.src) &&
      (!f.status || c.status === f.status) &&
      (!kw || c.no.toLowerCase().includes(kw) || c.title.includes(kw) || c.owner.includes(kw)),
  );
}

async function loadAll(): Promise<Capa[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => capaSchema.parse(decodeFromFirestore(d.data())));
  }
  return memory;
}

async function persist(c: Capa): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, c.no), encodeForFirestore(c));
    return;
  }
  const i = memory.findIndex((m) => m.no === c.no);
  if (i >= 0) memory[i] = c;
  else memory = [c, ...memory];
}

export const capaRepo = {
  async list(filter?: CapaFilter): Promise<Capa[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(no: string): Promise<Capa | null> {
    const rows = await loadAll();
    return rows.find((c) => c.no === no) ?? null;
  },

  /** 신규 등록 — CAPA-YYMMDD-NNN 채번 후 '진행' 상태로 생성. */
  async create(draft: CapaDraft, now: Date): Promise<Capa> {
    const dateKey = yymmdd(now);
    const seq = await counterRepo.next(`CAPA-${dateKey}`);
    const capa = capaSchema.parse({
      ...draft,
      no: formatCapaNo(dateKey, seq),
      status: '진행',
    });
    await persist(capa);
    return capa;
  },

  /** 등록/수정(upsert). */
  async save(c: Capa): Promise<void> {
    await persist(capaSchema.parse(c));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(no: string, to: Capa['status']): Promise<void> {
    const cur = await this.get(no);
    if (!cur) throw new Error(`CAPA를 찾을 수 없습니다: ${no}`);
    if (!canTransition(cur.status, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.status} → ${to}`);
    }
    await persist({ ...cur, status: to });
  },
};
