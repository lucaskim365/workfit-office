import { addDays, isDone } from './rules';
import type { PmIssue, PmMeeting, PmReport, PmTask } from './schema';
import { isFP, siteStats, weekStart, type SiteCtx } from './site';
import { updInfoOf, updIndex, type UpdInputs, type UpdItem } from './my';
import type { PmTicket } from './ticket';

/**
 * 주간 진행률 · 보고서 — 이슈 · 회의 · 보고 › 주간 진행률 · 보고서 (데모 pWeekCheck 7915 · docReport 4317).
 * 진행률 갱신(이번 주 체크인): 사업마다 이번 주 갱신할 업무(updInfo — 3-5 와 같은 규칙) 중 갱신한 비율.
 * 주간 보고서: 업무 목록 · 티켓 · 이슈 · 회의록 · 특이사항으로 회사 양식 6항목을 자동으로 채움.
 */

// ── 진행률 갱신 ────────────────────────────────────────

export interface WcSite { c: SiteCtx; items: UpdItem[]; n: number; ok: number; note: boolean }
export interface WcBoard {
  /** 보이는 사업 (내가 PM인 사업 · 없거나 '전체 사업 보기'면 전체) */
  list: WcSite[];
  mine: boolean;
  tot: number;
  okAll: number;
  /** 이번 주 갱신한 비율 (없으면 100) */
  pct: number;
  /** 갱신할 업무가 없거나 다 한 사업 */
  fin: number;
}
/** 이번 주 체크인 판 (pWeekCheck sumCard) — 업무가 있는 진행 중 사업만 (liveSites · pst.n) */
export function wcBoard(sites: readonly SiteCtx[], X: UpdInputs, me: string, pmOf: (c: SiteCtx) => string[], all: boolean, reports: readonly PmReport[]): WcBoard {
  const idx = updIndex(X);
  const f = updInfoOf(X, idx);
  const ws = weekStart(X.today);
  const live = sites.filter((c) => c.ts.length);
  const mine = live.filter((c) => pmOf(c).includes(me));
  const use = all || !mine.length ? live : mine;
  const list = use.map((c) => {
    const items = c.ts.map(f).filter((x): x is UpdItem => !!x);
    return { c, items, n: items.length, ok: items.filter((x) => x.done).length, note: reports.some((r) => r.projectId === c.p.id && r.week === ws && !!r.note) };
  });
  const tot = list.reduce((a, r) => a + r.n, 0);
  const okAll = list.reduce((a, r) => a + r.ok, 0);
  return { list, mine: !all && mine.length > 0, tot, okAll, pct: tot ? Math.round((okAll / tot) * 100) : 100, fin: list.filter((r) => !r.n || r.ok === r.n).length };
}

export interface WcPerson { who: string; all: UpdItem[]; left: UpdItem[]; late: number; stale: number }
/** 사람별 갱신 현황 (pWeekCheck people) — 입력 책임자별, 남은 것 많은 순 */
export function wcPeople(items: readonly UpdItem[]): WcPerson[] {
  const m = new Map<string, WcPerson>();
  for (const x of items) {
    const id = x.who || '';
    const r = m.get(id) ?? { who: id, all: [], left: [], late: 0, stale: 0 };
    r.all.push(x);
    if (!x.done) { r.left.push(x); if (x.why === 'late') r.late++; if (x.why === 'stale') r.stale++; }
    m.set(id, r);
  }
  return [...m.values()].sort((a, b) => b.left.length - a.left.length || b.all.length - a.all.length);
}
const WHY_N = { recent: -1, late: 0, week: 1, stale: 2 } as const;
/** 갱신 전후로 줄 순서가 바뀌지 않게: 이유 → 마감 → 업무 번호 (updSortStable) */
export const updSortStable = (a: UpdItem, b: UpdItem) =>
  WHY_N[a.why] - WHY_N[b.why] || ((a.t.end || '9') < (b.t.end || '9') ? -1 : (a.t.end || '9') > (b.t.end || '9') ? 1 : 0) || (a.t.id < b.t.id ? -1 : 1);

// ── 주간 보고서 ────────────────────────────────────────

export interface WeekReport {
  ws: string;
  we: string;
  /** 차주 (다음 주 월 ~ 일) */
  nws: string;
  nwe: string;
  /** 그 달 몇째 주 (일자 ÷ 7 올림) */
  wkNo: number;
  act: number;
  plan: number;
  done: number;
  n: number;
  late: PmTask[];
  /** 2. 금주 진행 업무 — 이번 주에 걸쳐 있는 안 끝난 업무 */
  prog: PmTask[];
  /** 3. 금주 완료 — 이번 주에 끝나는 완료 업무 + 이번 주에 완료된 티켓(위 업무 말고) */
  doneRows: Array<[string, string, string]>;
  /** 4. 미해결 이슈 */
  iss: PmIssue[];
  /** 금주 회의 결정사항 */
  mts: PmMeeting[];
  /** 5. 차주 시작 업무 */
  next: PmTask[];
  /** 금주 작업 시간 (업무계획 시간) */
  hours: number;
}
/** 주간 보고서 (docReport) — off = 이번 주에서 몇 주 앞뒤 */
export function weekReport(c: SiteCtx, off: number, X: { tickets: readonly PmTicket[]; issues: readonly PmIssue[]; meetings: readonly PmMeeting[]; hours: (projectId: string, from: string, to: string) => number }): WeekReport {
  const ws = weekStart(c.today, off);
  const we = addDays(ws, 6);
  const nws = addDays(ws, 7);
  const nwe = addDays(ws, 13);
  const st = siteStats(c);
  const fin = (t: PmTask) => isDone(c.live(t));
  const ts = c.ts.filter((t) => !isFP(t));
  const prog = ts.filter((t) => !!t.start && t.start <= we && t.end >= ws && !fin(t));
  const doneT = ts.filter((t) => fin(t) && !!t.end && t.end >= ws && t.end <= we);
  const doneTk = X.tickets.filter((x) => x.projectId === c.p.id && x.status === '완료' && x.hist.some((h) => /완료/.test(h.text ?? '') && h.date >= ws && h.date <= we) && !doneT.some((t) => t.id === x.taskId));
  return {
    ws, we, nws, nwe,
    wkNo: Math.ceil(+ws.slice(8) / 7),
    act: st.act, plan: st.plan, done: c.ts.filter(fin).length, n: st.n, late: st.late,
    prog,
    doneRows: [...doneT.map((t) => [t.code, t.name, t.output] as [string, string, string]), ...doneTk.map((x) => [x.code, x.title, x.files.map((f) => f.name).join(', ') || x.output] as [string, string, string])],
    iss: X.issues.filter((i) => i.projectId === c.p.id && i.status !== '해결'),
    mts: X.meetings.filter((m) => m.projectId === c.p.id && m.date >= ws && m.date <= we),
    next: ts.filter((t) => !!t.start && t.start >= nws && t.start <= nwe),
    hours: X.hours(c.p.id, ws, we),
  };
}

