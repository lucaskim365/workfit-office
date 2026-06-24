import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { decodeFromFirestore, encodeForFirestore } from '@/shared/lib/firestore-codec';
import { vocSchema, type Voc, type VocDraft } from '@/domain/voc/schema';
import { canTransition } from '@/domain/voc/status';
import { yymmdd, formatVocNo } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { VOC_SEED } from '@/data/seeds/voc.seed';

/**
 * 고객 클레임(VOC) Repository — 채번(counters) + 상태머신 전이를 강제.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'voc';

export interface VocFilter {
  status?: string;
  type?: string;
  q?: string;
}

let memory: Voc[] = VOC_SEED.map((v) => vocSchema.parse(v));

function applyFilter(rows: Voc[], f?: VocFilter): Voc[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (v) =>
      (!f.status || v.status === f.status) &&
      (!f.type || v.type === f.type) &&
      (!kw || v.no.toLowerCase().includes(kw) || v.cust.includes(kw) || v.prod.includes(kw) || v.code.toLowerCase().includes(kw)),
  );
}

async function loadAll(): Promise<Voc[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => vocSchema.parse(decodeFromFirestore(d.data())));
  }
  return memory;
}

async function persist(v: Voc): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, v.no), encodeForFirestore(v));
    return;
  }
  const i = memory.findIndex((m) => m.no === v.no);
  if (i >= 0) memory[i] = v;
  else memory = [v, ...memory];
}

export const vocRepo = {
  async list(filter?: VocFilter): Promise<Voc[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(no: string): Promise<Voc | null> {
    const rows = await loadAll();
    return rows.find((v) => v.no === no) ?? null;
  },

  /** 신규 접수 — VOC-YYMMDD-NNN 채번 후 '접수' 상태로 생성. */
  async create(draft: VocDraft, now: Date): Promise<Voc> {
    const dateKey = yymmdd(now);
    const seq = await counterRepo.next(`VOC-${dateKey}`);
    const voc = vocSchema.parse({
      ...draft,
      no: formatVocNo(dateKey, seq),
      status: '접수',
    });
    await persist(voc);
    return voc;
  },

  /** 등록/수정(upsert). */
  async save(v: Voc): Promise<void> {
    await persist(vocSchema.parse(v));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(no: string, to: Voc['status']): Promise<void> {
    const cur = await this.get(no);
    if (!cur) throw new Error(`VOC를 찾을 수 없습니다: ${no}`);
    if (!canTransition(cur.status, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.status} → ${to}`);
    }
    await persist({ ...cur, status: to });
  },
};
