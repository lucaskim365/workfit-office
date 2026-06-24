import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { dailyCheckSchema, type DailyCheck } from '@/domain/dailyCheck/schema';
import { canTransition } from '@/domain/dailyCheck/status';
import { DAILY_CHECK_SEED } from '@/data/seeds/dailyCheck.seed';

/**
 * 일상점검 Repository — 설비별 점검 세션 상태머신 전이를 강제. (채번 없음)
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'dailyChecks';

export interface DailyCheckFilter {
  state?: string;
  q?: string;
}

let memory: DailyCheck[] = DAILY_CHECK_SEED.map((d) => dailyCheckSchema.parse(d));

function applyFilter(rows: DailyCheck[], f?: DailyCheckFilter): DailyCheck[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (d) =>
      (!f.state || d.state === f.state) &&
      (!kw || d.code.toLowerCase().includes(kw) || d.name.includes(kw)),
  );
}

async function loadAll(): Promise<DailyCheck[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => dailyCheckSchema.parse(d.data()));
  }
  return memory;
}

async function persist(d: DailyCheck): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, d.code), d);
    return;
  }
  const i = memory.findIndex((m) => m.code === d.code);
  if (i >= 0) memory[i] = d;
  else memory = [...memory, d];
}

export const dailyCheckRepo = {
  async list(filter?: DailyCheckFilter): Promise<DailyCheck[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(code: string): Promise<DailyCheck | null> {
    const rows = await loadAll();
    return rows.find((d) => d.code === code) ?? null;
  },

  /** 등록/수정(upsert). */
  async save(d: DailyCheck): Promise<void> {
    await persist(dailyCheckSchema.parse(d));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(code: string, to: DailyCheck['state']): Promise<void> {
    const cur = await this.get(code);
    if (!cur) throw new Error(`일상점검 세션을 찾을 수 없습니다: ${code}`);
    if (!canTransition(cur.state, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.state} → ${to}`);
    }
    await persist({ ...cur, state: to });
  },
};
