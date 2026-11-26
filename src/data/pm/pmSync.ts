import type { ZodTypeAny } from 'zod';
import {
  bodyOf, docKeyOf, kindDef, LOG_COLL, parseBody, PM_COLLS, PmDbMissingError, PmExistsError, PmRateLimitError, recsOf, rowOf, stampCmp,
  type PmCollDef, type PmDb, type PmDocRec, type PmKindDef, type PmRow,
} from './pmDb';
import type { PmSnapshot } from './pm.store';

/**
 * PM 저장 계층 (설계 5.7.2 · 5.7.3) — 저장 함수 90개의 계산은 그대로 두고, 계산 전 · 뒤 스냅숏을 비교해
 * **바뀐 문서만** 정해진 순서로 쓴다. 고칠 문서는 쓰기 전에 DB 내용과 비교해 남이 먼저 고쳤으면 멈춘다.
 */

/** 저장 계층이 기억하는 문서 하나 — DB 에서 읽었거나 내가 쓴 것 */
interface Known {
  kind: string;
  /** 이 코드가 만든 글자 (기록 → bodyOf) — 바뀌었는지 볼 때 */
  norm: string;
  /** DB 의 body 글자 그대로 — 남이 고쳤는지 볼 때 (5.7.3 ①) */
  raw: string;
  at: number;
  seq: number;
  /** 읽어서 화면 상태에 넣었음 (모양이 틀려 못 읽은 문서는 false — 지우지도 않음) */
  inState: boolean;
}

export class PmConflictError extends Error {
  constructor(msg = '다른 사람이 먼저 고쳤습니다. 다시 읽었으니 확인 후 다시 저장해 주세요') { super(msg); this.name = 'PmConflictError'; }
}
/** 번호를 새로 받는 문서(티켓 · 이슈 · CR)가 겹침 → 다시 읽고 다음 번호로 */
export class PmNumberTakenError extends Error { constructor(public readonly coll: string) { super(`번호 겹침 (${coll})`); this.name = 'PmNumberTakenError'; } }
/** 사업키 겹침 (N2) — 다른 사람이 같은 사업키로 먼저 등록 */
export class PmProjectTakenError extends Error { constructor(public readonly id: string) { super(`사업키 ${id} 겹침`); this.name = 'PmProjectTakenError'; } }
/** 쓰다가 끊김 — 앞에서 쓴 것은 남음 */
export class PmPartialError extends Error { constructor(public readonly cause0: unknown) { super('저장 중 끊김'); this.name = 'PmPartialError'; } }
export class PmTooBigError extends Error {
  constructor(coll: string, id: string, n: number) { super(`기록 하나가 너무 커서 저장할 수 없습니다 (${coll} ${id}, ${n.toLocaleString()}자 — 1,000,000자까지)`); this.name = 'PmTooBigError'; }
}

export const BODY_MAX = 1_000_000;
/** 한 번에 같이 보내는 쓰기 수 (K4 d) */
const PARALLEL = 5;
/** 쓰기 제한(429) — 머리말에 다시 써도 되는 시각이 없으면 10 → 20 → 40초 … 로 늘려 기다림 (F1) */
const RATE_WAIT_MS = 10_000;
/** 한 번 막힌 자리에서 합쳐 이만큼 넘게 기다려도 안 되면 '일부만 저장' — Appwrite 제한 창(60초)보다 길게 (F1) */
export const RATE_GIVE_UP_MS = 65_000;
/** 진행 표시를 보내는 쓰기 수 (K4 d) */
export const PROGRESS_FROM = 20;

export interface PmProgress {
  done: number;
  total: number;
  /** 쓰기 제한으로 기다리는 중 (이번에 기다릴 ms) — 쓰기 수와 상관없이 알림 (F1) */
  waitMs?: number;
}

type OpKind = 'insert' | 'save' | 'remove';
interface Op {
  coll: string;
  kind: OpKind;
  key: string;
  row?: PmRow;
  /** 쓴 뒤 기억할 값 */
  next?: Known;
  /** 내용 비교 대상 (고치기 — 마지막으로 아는 DB 글자) */
  expect?: string;
}
export interface PmPlan {
  phases: Op[][][];
  writes: number;
}

export interface PmLoaded {
  snap: PmSnapshot;
  notices: string[];
  /** 끊긴 번호 바꾸기 (새 번호 → 옛 번호) */
  rekeyMarks: Map<string, string>;
  empty: boolean;
}

const shapeKeys = (s: ZodTypeAny | undefined): string[] | null => {
  const sh = (s as unknown as { shape?: Record<string, unknown> } | undefined)?.shape;
  return sh ? Object.keys(sh) : null;
};

export function createPmSync(db: PmDb) {
  const known = new Map<string, Map<string, Known>>(PM_COLLS.map((c) => [c.name, new Map()]));
  let last = { at: 0, seq: 0 };
  /** 늘 커지는 순서 값 — 시계가 멈춰 있어도(테스트) 순번으로 */
  const stamp = (after?: { at: number; seq: number }) => {
    const now = Date.now();
    let s = now > last.at ? { at: now, seq: 0 } : { at: last.at, seq: last.seq + 1 };
    if (after && stampCmp(s, after) <= 0) s = { at: after.at, seq: after.seq + 1 };
    last = s;
    return s;
  };
  const bump = (r: { at: number; seq: number }) => { if (stampCmp(r, last) > 0) last = { at: r.at, seq: r.seq }; };
  let progress: ((p: PmProgress) => void) | null = null;

  /** 23개 전부 읽기 (동시에) → 스냅숏. base = 빈 상태 (계획서 내장 데이터 · 기본 설정) */
  async function load(base: PmSnapshot): Promise<PmLoaded> {
    const missing: string[] = [];
    const got = await Promise.all(PM_COLLS.map(async (def) => {
      try { return await db.coll(def.name).list(); } catch (e) {
        if (e instanceof PmDbMissingError) { missing.push(...e.colls); return []; }
        throw e;
      }
    }));
    if (missing.length) throw new PmDbMissingError(missing);
    const snap = structuredClone(base);
    const rekeyMarks = new Map<string, string>();
    const bad = new Map<string, number>();
    let total = 0;
    PM_COLLS.forEach((def, ci) => {
      // 쪽(100건씩)을 읽는 사이 변동으로 같은 문서가 두 번 오면 나중 것 하나만 — 안 그러면 다음 저장마다 '같은 id 기록이 2건'
      const uniq = new Map<string, PmRow>();
      for (const row of got[ci]) uniq.set(docKeyOf(row), row);
      const rows = [...uniq.values()];
      total += rows.length;
      const kn = new Map<string, Known>();
      known.set(def.name, kn);
      const byKind = new Map<string, Array<{ row: PmRow; rec: Record<string, unknown> }>>();
      for (const row of rows) {
        bump(row);
        const kd = kindDef(def, row.kind);
        const p = kd ? parseBody(kd, row.body) : null;
        const key = docKeyOf(row);
        if (!kd || !p) {
          kn.set(key, { kind: row.kind, norm: '', raw: row.body, at: row.at, seq: row.seq, inState: false });
          bad.set(def.name, (bad.get(def.name) ?? 0) + 1);
          continue;
        }
        if (def.name === 'pmTasks' && typeof p.raw.rekeyFrom === 'string') rekeyMarks.set(String(p.rec.id), p.raw.rekeyFrom);
        kn.set(key, { kind: row.kind, norm: bodyOf(p.rec), raw: row.body, at: row.at, seq: row.seq, inState: true });
        const a = byKind.get(row.kind) ?? [];
        a.push({ row, rec: p.rec });
        byKind.set(row.kind, a);
      }
      for (const kd of def.kinds) {
        const list = byKind.get(kd.kind) ?? [];
        list.sort((x, y) => def.sort === 'order'
          ? (Number(x.rec.order) || 0) - (Number(y.rec.order) || 0) || stampCmp(x.row, y.row)
          : def.sort === 'stampDesc' ? stampCmp(y.row, x.row) : stampCmp(x.row, y.row));
        const s = snap as unknown as Record<string, unknown>;
        if (kd.kind === 'meta') {
          const m = list[0]?.rec;
          if (m) { snap.baseDate = String(m.baseDate ?? ''); snap.sourceVersion = String(m.sourceVersion ?? ''); snap.lastProjectNo = Number(m.lastProjectNo) || 0; }
        } else if (kd.single) {
          if (list[0]) s[kd.field] = kd.schema ? list[0].rec : { ...(s[kd.field] as object), ...list[0].rec };
        } else s[kd.field] = list.map((x) => x.rec);
      }
    });
    const notices = health(snap, rekeyMarks, bad, total === 0);
    return { snap, notices, rekeyMarks, empty: total === 0 };
  }

  /**
   * 바뀐 문서 목록 → 쓰는 순서 (5.7.2): ① 번호 받는 문서 · 사업 문서 새로 → ② 새로 만들기 → ③ 고치기 → ④ 지우기(거꾸로)
   * → ⑤ 변경 이력 → ⑥ 번호 바꾸기 표시 지우기. 컬렉션 경계마다 끊어 쓴다.
   */
  function plan(draft: PmSnapshot, rekeyed: ReadonlyArray<readonly [string, string]>): PmPlan {
    const P1: Op[][] = []; const P2: Op[][] = []; const P3: Op[][] = []; const P4: Op[][] = []; const P5: Op[][] = []; const P6: Op[][] = [];
    const rekeyNew = new Map(rekeyed.map(([o, n]) => [n, o]));
    for (const def of PM_COLLS) {
      const kn = known.get(def.name)!;
      const ins: Op[] = []; const ups: Op[] = []; const rms: Op[] = []; const fin: Op[] = [];
      const seen = new Set<string>();
      for (const kd of def.kinds) {
        const recs = recsOf(def, kd, draft);
        const seqOrder = def.sort === 'stampDesc' ? [...recs].reverse() : recs;
        let prev: { at: number; seq: number } | null = null;
        let broken = false;
        for (const d of seqOrder) {
          if (seen.has(d.key)) throw new Error(`같은 id 기록이 2건입니다 (${def.name} ${d.key})`);
          seen.add(d.key);
          const k = kn.get(d.key);
          // 순서: 지금 자리가 앞 문서 뒤면 그대로, 아니면(새 문서 · 뒤로 옮긴 문서) 그 뒤 모두 새 순서 값 — 메모리판 push · filter+push 순서를 되살림
          let st: { at: number; seq: number };
          let restamp = false;
          if (def.sort === 'order') {
            st = k?.inState ? { at: k.at, seq: k.seq } : stamp();
          } else if (!broken && k?.inState && (!prev || stampCmp(k, prev) > 0)) {
            st = { at: k.at, seq: k.seq };
          } else {
            broken = true;
            st = stamp(prev ?? undefined);
            restamp = !!k?.inState;
          }
          prev = st;
          const norm = bodyOf(d.rec);
          const mark = def.name === 'pmTasks' ? rekeyNew.get(d.id) : undefined;
          if (!k) {
            const body = mark ? bodyOf({ ...d.rec, rekeyFrom: mark }) : norm;
            ins.push(op(def, kd, d, 'insert', st, body, norm));
          } else if (!k.inState || k.norm !== norm || restamp || mark) {
            const body = withUnknown(kd, k.raw, d.rec, mark);
            ups.push({ ...op(def, kd, d, 'save', st, body, norm), expect: k.raw });
          }
          if (mark) fin.push(op(def, kd, d, 'save', st, withUnknown(kd, k?.raw ?? '', d.rec), norm));
        }
      }
      // 지우기도 마지막으로 아는 글자와 비교 — 남이 방금 고친 문서를 모른 채 지우지 않게
      for (const [key, k] of kn) if (k.inState && !seen.has(key)) rms.push({ coll: def.name, kind: 'remove', key, expect: k.raw });
      const first = def.numbered || def.name === 'pmProjects';
      if (def.name === LOG_COLL) { if (ins.length || ups.length) P5.push([...ins, ...ups]); }
      else {
        if (ins.length) (first ? P1 : P2).push(ins);
        if (ups.length) P3.push(ups);
      }
      if (rms.length) P4.unshift(rms);
      if (fin.length) P6.push(fin);
    }
    const phases = [P1, P2, P3, P4, P5, P6].filter((p) => p.length);
    return { phases, writes: phases.flat(2).length };
  }

  function op(def: PmCollDef, kd: PmKindDef, d: PmDocRec, kind: OpKind, st: { at: number; seq: number }, body: string, norm: string): Op {
    if (body.length > BODY_MAX) throw new PmTooBigError(def.name, d.id, body.length);
    const row = rowOf(def, kd, d, st.at, st.seq, body);
    return { coll: def.name, kind, key: d.key, row, next: { kind: d.kind, norm, raw: body, at: st.at, seq: st.seq, inState: true } };
  }
  /** N3: DB 글자에서 이 코드가 모르는 맨 위 칸은 그대로 붙여 씀 */
  function withUnknown(kd: PmKindDef, raw: string, rec: Record<string, unknown>, mark?: string): string {
    const keys = shapeKeys(kd.schema);
    let extra: Record<string, unknown> = {};
    if (keys && raw) {
      try {
        const r = JSON.parse(raw) as Record<string, unknown>;
        for (const k of Object.keys(r)) if (!keys.includes(k) && k !== 'rekeyFrom') extra[k] = r[k];
      } catch { extra = {}; }
    }
    return bodyOf({ ...extra, ...rec, ...(mark ? { rekeyFrom: mark } : {}) });
  }

  /**
   * ① 쓰기 전 확인 — 하나라도 걸리면 아무것도 안 쓴다.
   * - 고치기 · 지우기: DB 내용이 마지막으로 아는 글자와 다르거나 없어졌으면 → PmConflictError
   * - 새로 만들기 (F2): 같은 key 가 이미 있으면 → 번호 문서 = PmNumberTakenError(다시 읽고 다음 번호) / 사업 = PmProjectTakenError / 그 밖 = PmConflictError.
   *   변경 이력은 무작위 id 라 안 봄 (저장마다 읽기 1번을 아끼려고).
   */
  async function check(p: PmPlan) {
    const by = new Map<string, Op[]>();
    // ⑥ 번호 바꾸기 표시 지우기는 같은 저장 안에서 방금 쓴 문서라 expect 없음 → 비교 안 함
    for (const o of p.phases.flat(2)) {
      const look = o.kind === 'insert' ? o.coll !== LOG_COLL : o.expect !== undefined;
      if (look) { const a = by.get(o.coll) ?? []; a.push(o); by.set(o.coll, a); }
    }
    let changed = false;
    let project = '';
    let number = '';
    let exists = false;
    await Promise.all([...by].map(async ([coll, ops]) => {
      const rows = await db.coll(coll).get(ops.map((o) => o.key));
      const cur = new Map(rows.map((r) => [docKeyOf(r), r.body]));
      const def = PM_COLLS.find((c) => c.name === coll)!;
      for (const o of ops) {
        if (o.kind !== 'insert') { if (cur.get(o.key) !== o.expect) changed = true; continue; }
        if (!cur.has(o.key)) continue;
        if (def.name === 'pmProjects') project = o.row!.id;
        else if (def.numbered) number = def.name;
        else exists = true;
      }
    }));
    // 남이 고친 것이 있으면 그것부터 (번호만 다시 받으면 남이 고친 것을 모른 채 덮을 수 있음)
    if (changed || exists) throw new PmConflictError();
    if (project) throw new PmProjectTakenError(project);
    if (number) throw new PmNumberTakenError(number);
  }

  /**
   * 순서대로 쓰기 — 5개씩. 429 는 기다렸다 남은 것부터: 한 자리에서 10 → 20 → 40초(머리말 시각이 있으면 그 시각),
   * 쓰기가 한 건이라도 나아가면 처음부터 다시 셈, 한 자리에서 합쳐 65초 넘게 막히면 그때 끊김 (F1).
   * 끊기면 PmPartialError — 단 맨 앞 단계(번호 문서 · 사업 문서)에서 겹침이면 같은 묶음에 먼저 써진 새 문서를 지우고 다시 하기로 (F2).
   */
  async function write(p: PmPlan) {
    let done = 0;
    const total = p.writes;
    const tell = (waitMs?: number) => { if (total > PROGRESS_FROM || waitMs) progress?.(waitMs ? { done, total, waitMs } : { done, total }); };
    const sleep = db.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    tell();
    const first = p.phases[0];
    /** 이 자리에서 기다린 횟수 · 합 (쓰기가 나아가면 0) */
    let waits = 0;
    let stuck = 0;
    for (const phase of p.phases) {
      for (const group of phase) {
        const pending = [...group];
        const wrote: Op[] = [];
        while (pending.length) {
          const batch = pending.splice(0, PARALLEL);
          const res = await Promise.allSettled(batch.map((o) => one(o)));
          // 먼저 다 센 뒤 던짐 — 같은 묶음 뒤쪽이 써졌는데 '저장하지 못했습니다'로 나오지 않게
          const fails: Array<{ e: unknown; o: Op }> = [];
          res.forEach((r, j) => { if (r.status === 'fulfilled') { done++; wrote.push(batch[j]); } else fails.push({ e: r.reason, o: batch[j] }); });
          if (fails.length < batch.length) { waits = 0; stuck = 0; }
          const hard = fails.find((f) => !(f.e instanceof PmRateLimitError));
          if (hard) {
            const def = PM_COLLS.find((c) => c.name === hard.o.coll)!;
            if (hard.e instanceof PmExistsError) {
              // 맨 앞 단계(①)에서 겹침 = 번호 다시 받기 / 사업키 겹침 (N2) — 같은 묶음에 먼저 써진 것은 되돌리고 더 쓰지 않음
              if (phase === first && (def.numbered || def.name === 'pmProjects') && (await undo(wrote))) {
                done -= wrote.length;
                if (!done) throw def.numbered ? new PmNumberTakenError(def.name) : new PmProjectTakenError(hard.o.row!.id);
              }
              throw done ? new PmPartialError(hard.e) : new PmConflictError();
            }
            throw done ? new PmPartialError(hard.e) : hard.e;
          }
          tell();
          if (fails.length) {
            const lim = fails[0].e as PmRateLimitError;
            if (stuck > RATE_GIVE_UP_MS) throw done ? new PmPartialError(lim) : lim;
            const ms = lim.resetMs ?? RATE_WAIT_MS * 2 ** waits;
            waits++;
            stuck += ms;
            tell(ms);
            await sleep(ms);
            pending.unshift(...fails.map((f) => f.o));
          }
        }
      }
    }
  }
  /** 방금 이 저장이 새로 만든 문서 지우기 (번호 겹침 되돌리기) — 다 지웠으면 true */
  async function undo(ops: readonly Op[]): Promise<boolean> {
    const r = await Promise.allSettled(ops.map(async (o) => { await db.coll(o.coll).remove(o.key); known.get(o.coll)!.delete(o.key); }));
    return r.every((x) => x.status === 'fulfilled');
  }
  async function one(o: Op) {
    const c = db.coll(o.coll);
    if (o.kind === 'remove') { await c.remove(o.key); known.get(o.coll)!.delete(o.key); return; }
    if (o.kind === 'insert') await c.insert(o.row!); else await c.save(o.row!);
    known.get(o.coll)!.set(o.key, o.next!);
  }

  return {
    load, plan, check, write,
    onProgress(fn: ((p: PmProgress) => void) | null) { progress = fn; },
  };
}

/** 처음 열 때 점검 (5.7.2) — 끊긴 저장 흔적. 고치는 화면은 없고 안내만 (pm.manage) */
export function health(snap: PmSnapshot, rekeyMarks: ReadonlyMap<string, string>, bad: ReadonlyMap<string, number>, empty: boolean): string[] {
  if (empty) return ['PM 저장소가 비어 있습니다 — 데이터 옮기기 전이라 빈 화면입니다. 저장은 막혀 있습니다.'];
  const out: string[] = [];
  const tasks = new Map(snap.tasks.map((t) => [t.id, t]));
  const codeOf = (id: string) => { const t = tasks.get(id); return t ? `${t.projectId} ${t.code}` : id; };
  for (const [nw, old] of rekeyMarks) {
    if (tasks.has(old)) out.push(`업무 ${codeOf(nw)} 의 번호 바꾸기가 끊겼습니다. 옛 번호 ${codeOf(old)} 업무를 열어 같은 새 번호로 다시 저장하면 남은 것을 옮기고 옛 업무를 지웁니다.`);
  }
  const dup = new Map<string, number>();
  for (const t of snap.tasks) { const k = `${t.projectId} ${t.code}`; dup.set(k, (dup.get(k) ?? 0) + 1); }
  const dups = [...dup].filter(([, n]) => n > 1).map(([k, n]) => `${k} (${n}건)`);
  if (dups.length) out.push(`같은 사업에 같은 번호 업무가 있습니다: ${dups.join(', ')}`);
  const subs = snap.subtasks.filter((s) => !tasks.has(s.taskId)).length;
  const tks = snap.tickets.filter((x) => x.taskId && !x.legacyKey && !tasks.has(x.taskId)).length;
  const fns = snap.functions.filter((f) => !tasks.has(f.id)).length;
  const parts = [subs && `세부 작업 ${subs}건`, tks && `티켓 ${tks}건`, fns && `세부 기능 ${fns}건`].filter(Boolean);
  if (parts.length) out.push(`없는 업무를 가리키는 기록: ${parts.join(' · ')} (저장이 중간에 끊긴 흔적일 수 있습니다)`);
  if (bad.size) out.push(`읽지 못한 기록 ${[...bad.values()].reduce((a, b) => a + b, 0)}건 (${[...bad].map(([c, n]) => `${c} ${n}`).join(' · ')}) — 화면에 안 보입니다.`);
  return out;
}
