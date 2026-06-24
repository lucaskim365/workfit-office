import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { spcAlarmSchema, type SpcAlarm } from '@/domain/spcAlarm/schema';
import { canTransition } from '@/domain/spcAlarm/status';
import { SPC_ALARM_SEED } from '@/data/seeds/spcAlarm.seed';

/**
 * SPC 품질알람 Repository — 상태머신 전이를 강제(채번 없음, id 외부 발급).
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'spcAlarms';

export interface SpcAlarmFilter {
  status?: string;
  type?: string;
  q?: string;
}

let memory: SpcAlarm[] = SPC_ALARM_SEED.map((a) => spcAlarmSchema.parse(a));

function applyFilter(rows: SpcAlarm[], f?: SpcAlarmFilter): SpcAlarm[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (a) =>
      (!f.status || a.status === f.status) &&
      (!f.type || a.type === f.type) &&
      (!kw || a.id.toLowerCase().includes(kw) || a.prod.includes(kw) || a.code.toLowerCase().includes(kw)),
  );
}

async function loadAll(): Promise<SpcAlarm[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => spcAlarmSchema.parse(d.data()));
  }
  return memory;
}

async function persist(a: SpcAlarm): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, a.id), a);
    return;
  }
  const i = memory.findIndex((m) => m.id === a.id);
  if (i >= 0) memory[i] = a;
  else memory = [a, ...memory];
}

export const spcAlarmRepo = {
  async list(filter?: SpcAlarmFilter): Promise<SpcAlarm[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(id: string): Promise<SpcAlarm | null> {
    const rows = await loadAll();
    return rows.find((a) => a.id === id) ?? null;
  },

  /** 등록/수정(upsert). */
  async save(a: SpcAlarm): Promise<void> {
    await persist(spcAlarmSchema.parse(a));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(id: string, to: SpcAlarm['status']): Promise<void> {
    const cur = await this.get(id);
    if (!cur) throw new Error(`알람을 찾을 수 없습니다: ${id}`);
    if (!canTransition(cur.status, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.status} → ${to}`);
    }
    await persist({ ...cur, status: to });
  },
};
