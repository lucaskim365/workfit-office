import test from 'node:test';
import { createPmStore, PM_READ_METHODS, type PmSnapshot, type PmStore, type PmStoreOpts } from './pm.store';
import { createFakePmDb, type FakePmDb } from './pmDb.fake';
import { snapshotRows } from './pmDb';

/**
 * 저장소 테스트를 두 번 (설계 5.7.4): ① 메모리 ② 저장 계층 + 가짜 DB.
 * ② 는 저장할 때마다 같은 가짜 DB 에서 새 저장소로 다시 읽어 지금 상태와 칸마다 같은지 본다 (테스트 ⓐ 를 모든 저장소 테스트에).
 */
export type StoreMode = 'memory' | 'db';
const MODES: StoreMode[] = ['memory', 'db'];

/** 7-5 처럼 메모리판 처음 값을 넣어 둔 가짜 DB */
export function seededDb(today: string, opts: Pick<PmStoreOpts, 'nid'> = {}): FakePmDb {
  const db = createFakePmDb();
  db.fill(snapshotRows(createPmStore(today, opts).peek().snap));
  return db;
}

/** 칸 이름 순으로 맞춘 JSON — 칸 순서(zod 가 읽으면 스키마 순)는 뜻이 없어 안 봄. 배열 순서는 봄 */
const J = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x));

/** 두 스냅숏의 첫 다른 곳 (같으면 null) — 빈 칸 undefined 와 칸 없음은 같게 */
export function snapDiff(a: PmSnapshot, b: PmSnapshot): string | null {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof PmSnapshot>;
  for (const k of keys) {
    const x = J(a[k]);
    const y = J(b[k]);
    if (x === y) continue;
    const xa = a[k] as unknown;
    const ya = b[k] as unknown;
    if (Array.isArray(xa) && Array.isArray(ya)) {
      if (xa.length !== ya.length) return `${k}: 건수 ${xa.length} ≠ ${ya.length}`;
      const i = xa.findIndex((v, j) => J(v) !== J(ya[j]));
      return `${k}[${i}]: ${J(xa[i]).slice(0, 300)} ≠ ${J(ya[i]).slice(0, 300)}`;
    }
    return `${k}: ${x?.slice(0, 300)} ≠ ${y?.slice(0, 300)}`;
  }
  return null;
}

/** 같은 DB 를 새로 읽은 저장소의 스냅숏 */
export async function reread(db: FakePmDb, today: string): Promise<PmSnapshot> {
  return (await createPmStore(today, { db }).refresh()).snap;
}

/** 저장할 때마다 다시 읽어 맞춰 보는 DB 저장소 */
export function checkedDbStore(today: string, db = seededDb(today), opts: Omit<PmStoreOpts, 'db'> = {}): PmStore & { db: FakePmDb } {
  const s = createPmStore(today, { ...opts, db });
  const out: Record<string, unknown> = { ...s, db };
  for (const k of Object.keys(s)) {
    if ((PM_READ_METHODS as readonly string[]).includes(k)) continue;
    const fn = (s as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[k];
    out[k] = async (...a: unknown[]) => {
      const r = await fn(...a);
      const d = snapDiff((await reread(db, today)), s.peek().snap);
      if (d) throw new Error(`[다시 읽기 다름] ${k} 뒤: ${d}`);
      return r;
    };
  }
  return out as unknown as PmStore & { db: FakePmDb };
}

export const makerOf = (mode: StoreMode) => (today: string): PmStore => (mode === 'memory' ? createPmStore(today) : checkedDbStore(today));

/** 같은 테스트를 메모리 · DB(가짜) 두 번 */
export function eachMode(name: string, fn: (mk: (today: string) => PmStore, mode: StoreMode) => Promise<void> | void) {
  for (const mode of MODES) test(`${name} [${mode === 'db' ? 'DB 가짜' : '메모리'}]`, () => fn(makerOf(mode), mode));
}
