import { addDays, diffDays } from './rules';
import { isFP } from './site';
import type { PmCode, PmOrg, PmProject, PmStdTask, PmTask } from './schema';
import { ORG_FIELD } from './master';

/**
 * 기준정보 › 사업 › 단계 › 업무 연결 (데모 linkData 3792 · sugList 3911) · 업무 목록 생성 (genPlan 3863) · 쓰는 곳 (orgUse · bizUse · stageUse · statusUse · stdUse).
 * 연결 = 같은 단계 안에서 이름이 같은 것(띄어쓰기 무시), 또는 사람이 직접 이은 것(tlink: 업무 ID → 표준 업무 ID).
 */
export const nmKey = (s: string) => String(s || '').replace(/\s+/g, '').toLowerCase();
const bigr = (s: string) => { const x = nmKey(s).replace(/[^가-힣a-z0-9]/g, ''); const o = new Set<string>(); for (let i = 0; i < x.length - 1; i++) o.add(x.slice(i, i + 2)); return o; };
/** 이름 비슷한 정도 (simTxt) — 글자 2개 묶음이 겹치는 비율 */
export function simTxt(a: string, b: string) {
  const A = bigr(a);
  const B = bigr(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  A.forEach((x) => { if (B.has(x)) n++; });
  return (2 * n) / (A.size + B.size);
}

export const stdOf = (std: readonly PmStdTask[], biz: string, stage: string) => std.filter((t) => t.biz === biz && t.stage === stage).sort((a, b) => a.ord - b.ord);
export const stagesOfBiz = (codes: readonly PmCode[], biz: string) => codes.filter((c) => c.group === 'stage' && c.biz === biz).sort((a, b) => a.ord - b.ord);

export interface LinkRow { std: PmStdTask | null; t: PmTask | null; how: '' | '직접' | '이름 같음'; sug: PmStdTask | null; sc: number }
export interface LinkStage { name: string; isStd: boolean; rows: LinkRow[]; nStd: number; nPrj: number; nLink: number }
/** 한 사업의 단계마다 표준 ↔ 사업 업무 (linkData) */
export function linkData(p: PmProject, tasks: readonly PmTask[], codes: readonly PmCode[], std: readonly PmStdTask[], tlink: ReadonlyMap<string, string>): LinkStage[] {
  const biz = p.biz;
  const ts = tasks.filter((t) => t.projectId === p.id && !isFP(t));
  const stdNames = stagesOfBiz(codes, biz).map((c) => c.name);
  const extra = [...new Set(ts.map((t) => t.stage))].filter((x) => !stdNames.includes(x));
  return [...stdNames, ...extra].map((name) => {
    const st = stdOf(std, biz, name);
    const pt = ts.filter((t) => t.stage === name);
    const used = new Set<string>();
    const rows: LinkRow[] = st.map((x) => {
      let t = pt.find((y) => tlink.get(y.id) === x.id) ?? null;
      let how: LinkRow['how'] = t ? '직접' : '';
      if (!t) { t = pt.find((y) => !tlink.get(y.id) && !used.has(y.id) && nmKey(y.name) === nmKey(x.name)) ?? null; if (t) how = '이름 같음'; }
      if (t) used.add(t.id);
      return { std: x, t, how, sug: null, sc: 0 };
    });
    const free = () => rows.filter((r) => r.std && !r.t).map((r) => r.std!);
    for (const t of pt.filter((y) => !used.has(y.id))) {
      let sug: PmStdTask | null = null;
      let sc = 0;
      for (const x of free()) { const v = simTxt(t.name, x.name) + (x.code && x.code === t.code ? 0.1 : 0); if (v > sc) { sc = v; sug = x; } }
      rows.push({ std: null, t, how: '', sug: sc >= 0.35 ? sug : null, sc });
    }
    return { name, isStd: stdNames.includes(name), rows, nStd: st.length, nPrj: pt.length, nLink: rows.filter((r) => r.std && r.t).length };
  });
}

export interface Sug { k: string; stage: string; t: PmTask; sug: PmStdTask; sc: number; dup: boolean; on: boolean }
/** 추천 일괄 연결 목록 (sugList) — 같은 표준을 두 업무가 추천받으면 더 비슷한 쪽만, 50% 이상은 미리 체크 */
export function sugList(sites: readonly PmProject[], data: (p: PmProject) => LinkStage[]): Sug[] {
  const out: Sug[] = [];
  for (const p of sites) for (const st of data(p)) for (const r of st.rows) if (!r.std && r.sug && r.t) out.push({ k: p.id, stage: st.name, t: r.t, sug: r.sug, sc: r.sc, dup: false, on: false });
  const best = new Map<string, Sug>();
  for (const x of out) { const id = `${x.k}|${x.sug.id}`; const b = best.get(id); if (!b || b.sc < x.sc) best.set(id, x); }
  for (const x of out) { x.dup = best.get(`${x.k}|${x.sug.id}`) !== x; x.on = !x.dup && x.sc >= 0.5; }
  return out;
}
/** 고른 추천을 연결 — 같은 표준에 겹치면 더 비슷한 것만 (sugApply) → [업무 ID, 표준 ID] · 건너뛴 수 */
export function sugPick(pick: readonly Sug[]): { pairs: Array<[string, string]>; skip: number } {
  const taken = new Set<string>();
  const pairs: Array<[string, string]> = [];
  let skip = 0;
  for (const x of [...pick].sort((a, b) => b.sc - a.sc)) { const id = `${x.k}|${x.sug.id}`; if (taken.has(id)) { skip++; continue; } taken.add(id); pairs.push([x.t.id, x.sug.id]); }
  return { pairs, skip };
}

export interface GenOpt { start: string; end: string; fit: boolean; pre: boolean; renum: boolean }
export interface GenRow { std: PmStdTask; stage: string; code: string; name: string; output: string; start: string; end: string; dur: number; milestone: boolean; have: PmTask | null }
/** 기준정보로 한 사업의 업무 목록 만들기 (genPlan) — 협약 기간에 맞추면 표준 전체 길이를 비례로 늘리고 줄임(협약 이전은 그대로) */
export function genPlan(p: PmProject, tasks: readonly PmTask[], codes: readonly PmCode[], std: readonly PmStdTask[], tlink: ReadonlyMap<string, string>, g: GenOpt, today: string) {
  const biz = p.biz;
  const stages = stagesOfBiz(codes, biz);
  const start = g.start || p.start || today;
  const end = g.end || p.end || addDays(start, 270);
  const stOrd = (n: string) => stages.find((x) => x.name === n)?.ord ?? 99;
  const list = std.filter((t) => t.biz === biz && (g.pre || !/협약 이전/.test(t.stage))).sort((a, b) => stOrd(a.stage) - stOrd(b.stage) || a.ord - b.ord);
  const span = Math.max(1, ...list.filter((t) => +t.off >= 0).map((t) => +t.off + +t.dur));
  const days = diffDays(start, end) + 1;
  const f = g.fit && span > 0 ? days / span : 1;
  const ts = tasks.filter((t) => t.projectId === p.id && !isFP(t));
  const sIdx = new Map<string, { n: number; i: number }>();
  let si = 0;
  const rows: GenRow[] = list.map((t) => {
    if (!sIdx.has(t.stage)) sIdx.set(t.stage, { n: ++si, i: 0 });
    const S = sIdx.get(t.stage)!;
    const pos = ++S.i;
    const off = +t.off < 0 ? +t.off : Math.round(+t.off * f);
    const dur = Math.max(1, Math.round((+t.dur || 1) * (+t.off < 0 ? 1 : f)));
    const st = addDays(start, off);
    const have = ts.find((x) => tlink.get(x.id) === t.id) ?? ts.find((x) => x.stage === t.stage && nmKey(x.name) === nmKey(t.name)) ?? null;
    return { std: t, stage: t.stage, code: g.renum ? `${S.n}.${pos}` : t.code || `${S.n}.${pos}`, name: t.name, output: t.output, start: st, end: addDays(st, dur - 1), dur, milestone: t.milestone, have };
  });
  return { start, end, days, span, f, rows, nHave: rows.filter((r) => r.have).length, nPrj: ts.length };
}

// ── 쓰는 곳 ──
export const orgUse = (o: PmOrg, projects: readonly PmProject[]) => projects.filter((p) => (p[ORG_FIELD[o.type]] || '').trim() === o.name);
export const bizUse = (c: PmCode, projects: readonly PmProject[]) => projects.filter((p) => p.biz === c.name);
export const stageUse = (c: PmCode, tasks: readonly PmTask[], projects: readonly PmProject[]) => { const ks = new Set(projects.filter((p) => p.biz === c.biz).map((p) => p.id)); return tasks.filter((t) => t.stage === c.name && ks.has(t.projectId)); };
export const statusUse = (c: PmCode, tasks: readonly PmTask[]) => tasks.filter((t) => t.status === c.name);
export const stdUse = (x: PmStdTask, tasks: readonly PmTask[], projects: readonly PmProject[]) => { const ks = new Set(projects.filter((p) => p.biz === x.biz).map((p) => p.id)); return tasks.filter((t) => t.name === x.name && t.stage === x.stage && ks.has(t.projectId)); };

/** 다음 번호 (wbsNextCode) — 그 단계 마지막 번호의 끝 숫자 + 1, 사업 안에서 겹치지 않게 (업무 추가 창과 같은 규칙) */
export function nextCodeIn(tasks: readonly PmTask[], projectId: string, stage: string): string {
  const codes = tasks.filter((t) => t.projectId === projectId && (t.group || t.stage) === stage).map((t) => t.code);
  if (!codes.length) return '';
  const m = codes[codes.length - 1].match(/^(.*?)(\d+)$/);
  if (!m) return '';
  const used = new Set(tasks.filter((t) => t.projectId === projectId).map((t) => t.code));
  let n = +m[2] + 1;
  let c = '';
  do c = m[1] + String(n++).padStart(m[2].length, '0'); while (used.has(c));
  return c;
}
