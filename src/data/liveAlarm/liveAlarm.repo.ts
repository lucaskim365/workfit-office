import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { liveAlarmSchema, type LiveAlarm } from '@/domain/liveAlarm/schema';
import { canTransition } from '@/domain/liveAlarm/status';
import { LIVE_ALARM_SEED } from '@/data/seeds/liveAlarm.seed';

/**
 * 설비 실시간 알람 Repository — 상태머신 전이를 강제(채번 없음, id 외부 발급).
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 상태머신 패턴)
 *
 * Firebase 미설정이면 in-memory seed 로 graceful degrade.
 */
const COLL = 'liveAlarms';

export interface AlarmFilter {
  state?: string;
  sev?: string;
  q?: string;
}

let memory: LiveAlarm[] = LIVE_ALARM_SEED.map((a) => liveAlarmSchema.parse(a));

function applyFilter(rows: LiveAlarm[], f?: AlarmFilter): LiveAlarm[] {
  if (!f) return rows;
  const kw = f.q?.trim().toLowerCase() ?? '';
  return rows.filter(
    (a) =>
      (!f.state || a.state === f.state) &&
      (!f.sev || a.sev === f.sev) &&
      (!kw ||
        a.id.toLowerCase().includes(kw) ||
        a.eq.includes(kw) ||
        a.code.toLowerCase().includes(kw) ||
        a.msg.includes(kw)),
  );
}

async function loadAll(): Promise<LiveAlarm[]> {
  if (isFirebaseConfigured && db) {
    const snap = await getDocs(collection(db, COLL));
    return snap.docs.map((d) => liveAlarmSchema.parse(d.data()));
  }
  return memory;
}

async function persist(a: LiveAlarm): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, COLL, a.id), a);
    return;
  }
  const i = memory.findIndex((m) => m.id === a.id);
  if (i >= 0) memory[i] = a;
  else memory = [a, ...memory];
}

export const liveAlarmRepo = {
  async list(filter?: AlarmFilter): Promise<LiveAlarm[]> {
    return applyFilter(await loadAll(), filter);
  },

  async get(id: string): Promise<LiveAlarm | null> {
    const rows = await loadAll();
    return rows.find((a) => a.id === id) ?? null;
  },

  /** 등록/수정(upsert). */
  async save(a: LiveAlarm): Promise<void> {
    await persist(liveAlarmSchema.parse(a));
  },

  /** 상태 전이(검증). 허용되지 않으면 throw. */
  async transition(id: string, to: LiveAlarm['state']): Promise<void> {
    const cur = await this.get(id);
    if (!cur) throw new Error(`알람을 찾을 수 없습니다: ${id}`);
    if (!canTransition(cur.state, to)) {
      throw new Error(`허용되지 않는 상태 전이: ${cur.state} → ${to}`);
    }
    await persist({ ...cur, state: to });
  },
};
