import { docKeyOf, PM_COLLS, PmDbMissingError, PmExistsError, PmRateLimitError, type PmCollApi, type PmDb, type PmRow } from './pmDb';

/**
 * 테스트용 가짜 DB (설계 5.7.4) — Appwrite 처럼 문서마다 body 를 JSON 글자로 들고 있고, 여러 저장소가 같이 쓸 수 있다.
 * 실제 서버 흉내: insert 는 같은 key 면 거부, save 는 없는 문서면 새로 만듦(공용 save 의 update → create), remove 는 없으면 넘어감.
 * 시험용 장치: N 번째 쓰기에서 오류 · 429 · 쓰기 늦추기 · 요청 세기.
 */
export interface FakePmDb extends PmDb {
  /** 컬렉션 → key → 줄 */
  data: Map<string, Map<string, PmRow>>;
  stats: { reads: number; writes: number };
  /** 다음 쓰기부터 센 n 번째 쓰기(1부터)에서 오류 — 그 쓰기는 안 됨 */
  failAt(n: number): void;
  /** 다음 쓰기부터 센 n 번째 쓰기에서 429 한 번 (다시 쓰면 됨) */
  rateLimitAt(n: number, resetMs?: number): void;
  /** 쓰기마다 기다리기 (잇단 저장 · 동시 발행 시험) */
  setWriteDelay(ms: number): void;
  /** 읽기(list)마다 기다리기 */
  setReadDelay(ms: number): void;
  /** 컬렉션을 없는 것으로 (스위치 가드 시험) */
  drop(name: string): void;
  fill(rows: Map<string, PmRow[]>): void;
  /** 기다린 ms 합 (429 시험 — 실제로는 안 기다림) */
  waited: number[];
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createFakePmDb(): FakePmDb {
  const data = new Map<string, Map<string, PmRow>>(PM_COLLS.map((c) => [c.name, new Map()]));
  const stats = { reads: 0, writes: 0 };
  let fail = 0;
  let limit: { n: number; reset?: number } | null = null;
  let wdelay = 0;
  let rdelay = 0;
  const waited: number[] = [];
  const copy = (r: PmRow): PmRow => structuredClone(r);
  const need = (name: string) => {
    const m = data.get(name);
    // Appwrite 연결(pmDbAppwrite)과 같게 — 컬렉션이 없으면 '준비 안 됨'
    if (!m) throw new PmDbMissingError([name]);
    return m;
  };
  const write = async (name: string, fn: (m: Map<string, PmRow>) => void) => {
    if (wdelay) await sleep(wdelay);
    stats.writes++;
    if (fail > 0 && --fail === 0) throw new Error('가짜 DB: 연결 끊김');
    if (limit && --limit.n === 0) { const r = limit.reset; limit = null; throw new PmRateLimitError(r); }
    fn(need(name));
  };
  const coll = (name: string): PmCollApi => ({
    async list() {
      if (rdelay) await sleep(rdelay);
      const m = need(name);
      stats.reads += Math.max(1, Math.ceil(m.size / 100));
      return [...m.values()].map(copy);
    },
    async get(keys) {
      const m = need(name);
      stats.reads += Math.max(1, Math.ceil(keys.length / 100));
      return keys.flatMap((k) => (m.has(k) ? [copy(m.get(k)!)] : []));
    },
    insert: (row) => write(name, (m) => {
      const k = docKeyOf(row);
      if (m.has(k)) throw new PmExistsError(name, k);
      m.set(k, copy(row));
    }),
    save: (row) => write(name, (m) => { m.set(docKeyOf(row), copy(row)); }),
    remove: (key) => write(name, (m) => { m.delete(key); }),
  });
  return {
    data, stats, waited, coll,
    async wait(ms) { waited.push(ms); },
    failAt(n) { fail = n; },
    rateLimitAt(n, reset) { limit = { n, reset }; },
    setWriteDelay(ms) { wdelay = ms; },
    setReadDelay(ms) { rdelay = ms; },
    drop(name) { data.delete(name); },
    fill(rows) {
      for (const [name, list] of rows) { const m = need(name); for (const r of list) m.set(docKeyOf(r), copy(r)); }
    },
  };
}
