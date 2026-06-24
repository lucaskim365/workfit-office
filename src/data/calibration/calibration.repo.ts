import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { decodeFromFirestore, encodeForFirestore } from '@/shared/lib/firestore-codec';
import {
  calibrationSchema,
  type Calibration,
  type CalibrationDraft,
} from '@/domain/calibration/schema';
import { canTransition } from '@/domain/calibration/status';
import { yymmdd, formatCalNo } from '@/domain/numbering';
import { counterRepo } from '@/data/counter/counter.repo';
import { CALIBRATION_SEED } from '@/data/seeds/calibration.seed';

/**
 * 검교정(Calibration) Repository — 채번(counters) + 상태머신 전이를 강제.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신+채번 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'calibrations';

export interface CalFilter {
  status?: string;
  q?: string;
}

let memory: Calibration[] = CALIBRATION_SEED.map((c) => calibrationSchema.parse(c));

function applyFilter(rows: Calibration[], f?: CalFilter): Calibration[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (c) =>
      (!f.status || c.status === f.status) &&
      (!kw || c.id.toLowerCase().includes(kw) || c.gage.includes(kw) || c.gid.toLowerCase().includes(kw)),
  );
}

async function loadAll(): Promise<Calibration[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => calibrationSchema.parse(decodeFromFirestore(d.data())));
  }
  return memory;
}

async function persist(c: Calibration): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, c.id), encodeForFirestore(c));
    return;
  }
  const i = memory.findIndex((m) => m.id === c.id);
  if (i >= 0) memory[i] = c;
  else memory = [c, ...memory];
}

export const calibrationRepo = {
  async list(filter?: CalFilter): Promise<Calibration[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(id: string): Promise<Calibration | null> {
    const rows = await loadAll();
    return rows.find((c) => c.id === id) ?? null;
  },

  /** 신규 등록 — CL-YYMMDD-NNN 채번 후 '예정' 상태로 생성. */
  async create(draft: CalibrationDraft, now: Date): Promise<Calibration> {
    const dateKey = yymmdd(now);
    const seq = await counterRepo.next(`CL-${dateKey}`);
    const cal = calibrationSchema.parse({
      ...draft,
      id: formatCalNo(dateKey, seq),
      status: '예정',
    });
    await persist(cal);
    return cal;
  },

  /** 등록/수정(upsert). */
  async save(c: Calibration): Promise<void> {
    await persist(calibrationSchema.parse(c));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(id: string, to: Calibration['status']): Promise<void> {
    const cur = await this.get(id);
    if (!cur) throw new Error(`검교정 건을 찾을 수 없습니다: ${id}`);
    if (!canTransition(cur.status, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.status} → ${to}`);
    }
    await persist({ ...cur, status: to });
  },
};
