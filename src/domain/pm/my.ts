import { addDays, diffDays, isDone, liveOf, prioOf, taskPeople, type Live } from './rules';
import type { PmAction, PmChangeLog, PmIssue, PmMilestoneOk, PmProject, PmTask, PmWeekCheck, PmChangeRequest } from './schema';
import { isDrop, isPre, weekStart } from './site';
import { workItemOf } from './team';
import { tkOpen, tkReviewPending, type PmTicket } from './ticket';

/**
 * 내 업무 계산 — 대시보드 › 내 업무 (pMy 3470), 3-5단계.
 * 데모 코드를 그대로 옮긴 순수 함수 (괄호 = 데모 함수·줄, 11/24 데모 기준). DB·화면을 모른다.
 * ([[2026-11-24-pms-port-design]] §5.3)
 *
 * '나' = 로그인한 그룹웨어 사용자 ID. 내 업무 = 업무 담당(assigneeIds)에 내가 있는 집계 대상 업무.
 */

const live = (m: ReadonlyMap<string, Live>, t: PmTask) => m.get(t.id) ?? liveOf(t);

/** 우선 순위 숫자 (prioOf 2347): 0 지연 · 1 7일 내 마감 · 2 진행 중 · 3 예정 */
export function prioN(t: PmTask, l: Live, today: string): 0 | 1 | 2 | 3 {
  const p = prioOf(t, l, today);
  return p === '지연' ? 0 : p === '7일 내 마감' ? 1 : p === '진행 중' ? 2 : 3;
}

export interface MyInputs {
  tasks: readonly PmTask[];
  liveMap: ReadonlyMap<string, Live>;
  projects: readonly PmProject[];
  today: string;
}

/** 정렬 2가지 (sortBy): 진행 중 우선(진행률 높은 순 → 마감 가까운 순) / 지연 우선(마감이 더 지난 · 가까운 순) */
export type MySort = 'prog' | 'late';
export const MY_SORTS: ReadonlyArray<readonly [MySort, string, string]> = [
  ['prog', '진행 중 우선', '진행률 높은 순 → 같으면 마감 가까운 순'],
  ['late', '지연 우선', '마감이 많이 지난 순 → 마감 가까운 순'],
];
const byEnd = (a: PmTask, b: PmTask) => ((a.end || '9') < (b.end || '9') ? -1 : (a.end || '9') > (b.end || '9') ? 1 : 0);
export function mySorter(m: MySort, liveMap: ReadonlyMap<string, Live>) {
  if (m === 'late') return byEnd;
  return (a: PmTask, b: PmTask) => live(liveMap, b).pct - live(liveMap, a).pct || byEnd(a, b);
}

export interface MyWork {
  /** 내가 담당인 집계 대상 업무 전부 (완료 포함) */
  all: PmTask[];
  /** 그중 미완료 */
  open: PmTask[];
  /** 지금 할 일 = 지연 · 7일 내 마감 · 진행 중, '나중에'로 내린 것 제외 */
  todo: PmTask[];
  /** 나중에 할 일 (사람마다 직접 내려 둔 것 — 지연 집계에는 영향 없음) */
  later: PmTask[];
  /** 2주 내 시작 (아직 기간 전, 시작일 순) */
  next: PmTask[];
  /** 지연된 내 업무 (지금 할 일 중) */
  nLate: number;
  /** 이번 주 마감 = 7일 내 마감 (지금 할 일 중) */
  nWeek: number;
}

/** 내 업무 나누기 (pMy 앞부분). laterIds = 내가 '나중에'로 내린 업무 ID */
export function myWork(me: string, X: MyInputs, laterIds: readonly string[], sort: MySort = 'prog', sortL: MySort = 'prog'): MyWork {
  const { liveMap, today } = X;
  const wi = workItemOf(X);
  const L = (t: PmTask) => live(liveMap, t);
  const all = X.tasks.filter((t) => wi(t) && taskPeople(t).includes(me));
  const open = all.filter((t) => !isDone(L(t)));
  const lat = new Set(laterIds);
  const later = open.filter((t) => lat.has(t.id)).sort(mySorter(sortL, liveMap));
  const todo = open.filter((t) => prioN(t, L(t), today) < 3 && !lat.has(t.id)).sort(mySorter(sort, liveMap));
  const t14 = addDays(today, 14);
  const next = open.filter((t) => prioN(t, L(t), today) === 3 && !!t.start && t.start <= t14).sort((a, b) => (a.start < b.start ? -1 : 1));
  return {
    all, open, todo, later, next,
    nLate: todo.filter((t) => prioN(t, L(t), today) === 0).length,
    nWeek: todo.filter((t) => prioN(t, L(t), today) === 1).length,
  };
}

/** 한 페이지 7건 (PG) — 범위를 벗어나면 마지막 페이지로 맞춤 (pageOf) */
export const MY_PAGE = 7;
export function pageOf<T>(list: readonly T[], page: number): { rows: T[]; n: number; page: number; total: number } {
  const n = Math.max(1, Math.ceil(list.length / MY_PAGE));
  const p = Math.min(Math.max(1, page || 1), n);
  return { rows: list.slice((p - 1) * MY_PAGE, p * MY_PAGE), n, page: p, total: list.length };
}

// ── 처리할 일 (inbox) ────────────────────────────────

/** 티켓 검토 · 승인할 사람 (tkRevWho 1570): 검토자 차례면 검토자, 아니면 승인자 */
export const tkRevWho = (x: PmTicket) => (tkReviewPending(x) ? x.reviewerId : x.approverId);

/** 같은 사업 · 같은 단계에서 마일스톤 종료일 전에 끝나야 하는 업무 (msReq 2401) */
export const msReqOf = (tasks: readonly PmTask[], t: PmTask) =>
  tasks.filter((x) => x.projectId === t.projectId && x.stage === t.stage && x.id !== t.id && !!x.end && x.end <= t.end);

export type Approval =
  | { kind: 'tk'; x: PmTicket }
  | { kind: 'ms'; t: PmTask }
  | { kind: 'cr'; c: PmChangeRequest };

export interface InboxInputs extends MyInputs {
  tickets: readonly PmTicket[];
  msOk: ReadonlyMap<string, PmMilestoneOk>;
  issues: readonly PmIssue[];
  actions: readonly PmAction[];
  /** 요구사항 변경 (4단계) */
  crs?: readonly PmChangeRequest[];
  /** 사업 PM (그룹웨어 사용자 ID 들) — 데모 myPm: 업무 목록 PM · 사업 정보 PM */
  pmOf: (p: PmProject) => string[];
}

export interface Inbox {
  /** 내 티켓 — 배정받은 진행 중 티켓 */
  tickets: PmTicket[];
  /** 승인 대기 — 내가 검토 · 승인할 티켓 · 내가 PM인 사업의 마일스톤 · 검토중 요구사항(CR) */
  appr: Approval[];
  /** 이슈 — 내 담당 · 관련 미해결 */
  issues: PmIssue[];
  /** 액션 아이템 — 회의에서 맡은 후속 조치 (기한 순) */
  actions: PmAction[];
  total: number;
}

/** 나에게 온 일 (pMy inbox) */
export function myInbox(me: string, X: InboxInputs): Inbox {
  const L = (t: PmTask) => live(X.liveMap, t);
  const tickets = X.tickets.filter((x) => tkOpen(x) && x.assigneeId === me);
  const rev = X.tickets.filter((x) => x.status === '검토요청' && tkRevWho(x) === me);
  // 마일스톤: 내가 PM인 사업 · 협약 이전 아님 · 완료 · 아직 승인 안 됨 · 같은 단계 앞선 업무가 다 끝남
  // 탈락 사업은 빼고 (데모 liveSites)
  const mine = new Set(X.projects.filter((p) => !isDrop(p) && X.pmOf(p).includes(me)).map((p) => p.id));
  const ms = X.tasks
    .filter((t) => mine.has(t.projectId) && t.milestone && !isPre(t) && isDone(L(t)) && !X.msOk.has(t.id) && msReqOf(X.tasks, t).every((x) => isDone(L(x))))
    .sort((a, b) => (a.end < b.end ? -1 : 1));
  // CR: 검토중 · 내가 PM인 사업 (데모 myPm — 탈락 사업도 포함)
  const pmAll = new Set(X.projects.filter((p) => X.pmOf(p).includes(me)).map((p) => p.id));
  const crs = (X.crs ?? []).filter((c) => c.status === '검토중' && pmAll.has(c.projectId));
  const appr: Approval[] = [...rev.map((x) => ({ kind: 'tk' as const, x })), ...ms.map((t) => ({ kind: 'ms' as const, t })), ...crs.map((c) => ({ kind: 'cr' as const, c }))];
  const issues = X.issues.filter((i) => (i.ownerId === me || i.watchIds.includes(me)) && i.status !== '해결');
  const actions = X.actions.filter((a) => !a.done && a.whoId === me).sort((a, b) => ((a.due || '9') < (b.due || '9') ? -1 : 1));
  return { tickets, appr, issues, actions, total: tickets.length + appr.length + issues.length + actions.length };
}

// ── 내가 참여하는 사업 ───────────────────────────────

export interface MySiteRow {
  projectId: string;
  /** 내 업무 수 · 완료 · 지연 */
  n: number;
  done: number;
  late: number;
  /** 이 사업의 지금 할 일 + 나중에 할 일 */
  board: number;
}
/** 내가 참여하는 사업 (siteRows) — 내 업무가 걸린 사업, 처음 나온 순 */
export function mySites(w: MyWork, X: MyInputs): MySiteRow[] {
  const L = (t: PmTask) => live(X.liveMap, t);
  const ks = [...new Set(w.all.map((t) => t.projectId))];
  return ks.map((k) => {
    const my = w.all.filter((t) => t.projectId === k);
    return {
      projectId: k,
      n: my.length,
      done: my.filter((t) => isDone(L(t))).length,
      late: my.filter((t) => !!t.end && t.end < X.today && !isDone(L(t))).length,
      board: w.todo.filter((t) => t.projectId === k).length + w.later.filter((t) => t.projectId === k).length,
    };
  });
}
/** 다음 마일스톤 (stats nextMs 2361) — 협약 이전 아님 · 미완료 중 종료일이 가장 이른 것 */
export function nextMilestone(ts: readonly PmTask[], liveMap: ReadonlyMap<string, Live>): PmTask | null {
  return ts.filter((t) => t.milestone && !isPre(t) && !isDone(live(liveMap, t))).sort((a, b) => (a.end < b.end ? -1 : 1))[0] ?? null;
}

// ── 진행률 갱신 (myUpdCard 7886 · updInfo 7847) ──────

/**
 * 갱신으로 치는 것 (updIdx 7823): 진행률 기록(변경 이력 '실적') · '변동 없음' 확인 · 티켓 진행 처리(진행률 · 완료 · 검토).
 * 데모는 업무계획에서 그 업무를 체크 · 메모한 것도 치는데, 업무계획은 3-6 에서 `more` 로 넣는다.
 */
export interface UpdInputs extends MyInputs {
  logs: readonly PmChangeLog[];
  checks: readonly PmWeekCheck[];
  tickets: readonly PmTicket[];
  /** 업무 목록 엑셀 갱신일 (baseDate) */
  baseDate: string;
  /** 사업 PM (사용자 ID, 첫 사람) — 담당이 없을 때 입력 책임자 (sitePm) */
  sitePm: (projectId: string) => string;
  /** 업무계획 기록 등 더 칠 날짜 (taskId → 날짜들) — 3-6 */
  more?: ReadonlyMap<string, readonly string[]>;
  /** 최근 7일 업무계획에 넣은 업무 (taskId → {who, d}) — 3-6 */
  planRecent?: ReadonlyMap<string, { who: string; d: string }>;
}
export function updIndex(X: UpdInputs): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const add = (id: string, d: string) => { if (!id || !d || d > X.today) return; const a = m.get(id) ?? []; a.push(d); m.set(id, a); };
  const byCode = new Map(X.tasks.map((t) => [`${t.projectId}|${t.code}`, t.id]));
  for (const x of X.logs) if (/실적/.test(x.text)) add(byCode.get(`${x.projectId}|${x.code}`) ?? '', x.date);
  for (const c of X.checks) add(c.taskId, c.date);
  for (const x of X.tickets) if (x.taskId) for (const h of x.hist) if (/진행률|완료|검토/.test(h.text ?? '')) add(x.taskId, h.date);
  for (const [id, ds] of X.more ?? []) for (const d of ds) add(id, d);
  return m;
}
/** 이 업무를 마지막으로 갱신한 날 (before 를 주면 그날 이전 기록 중 마지막) (taskUpd) */
export function taskUpd(idx: ReadonlyMap<string, readonly string[]>, id: string, before?: string): string {
  let d = '';
  for (const x of idx.get(id) ?? []) if ((!before || x < before) && x > d) d = x;
  return d;
}

export type UpdWhy = 'recent' | 'late' | 'week' | 'stale';
/** '왜' 칸 — 묻는 이유일 뿐이라 모두 회색 (UPD_WHY) */
export const UPD_WHY: Record<UpdWhy, string> = { recent: '최근 한 업무', late: '마감 지남', week: '이번 주 마감', stale: '2주 넘게 갱신 없음' };
export interface UpdItem { t: PmTask; why: UpdWhy; done: boolean; last: string; who: string }

/**
 * 이번 주 갱신할 업무 1건 (updInfo): 시작했고 집계 대상인 업무 중
 * 최근 7일 업무계획에 넣음 · 마감 지남 · 이번 주 마감 · 2주 넘게 갱신 없음. 이번 주에 갱신하면 done.
 * 입력 책임자 = 첫 담당자 (그룹웨어 사람은 모두 사내라 데모의 '외부 인원 건너뛰기'는 없음), 없으면 사업 PM.
 */
export function updInfoOf(X: UpdInputs, idx: ReadonlyMap<string, readonly string[]>) {
  const wi = workItemOf(X);
  const ws = weekStart(X.today);
  const we = addDays(ws, 6);
  return (t: PmTask): UpdItem | null => {
    if (!wi(t) || !t.start || t.start > X.today) return null;
    const u = taskUpd(idx, t.id);
    const done = u >= ws;
    const fin = isDone(live(X.liveMap, t));
    if (fin && !done) return null;
    const prev = taskUpd(idx, t.id, ws) || X.baseDate;
    const rc = !fin ? X.planRecent?.get(t.id) : undefined;
    const why: UpdWhy | null = rc ? 'recent' : t.end && t.end < ws ? 'late' : t.end && t.end <= we ? 'week' : diffDays(prev, X.today) > 14 ? 'stale' : null;
    if (!why) return null;
    const who = rc && taskPeople(t).includes(rc.who) ? rc.who : taskPeople(t)[0] || X.sitePm(t.projectId);
    return { t, why, done, last: u, who };
  };
}
const WHY_N: Record<UpdWhy, number> = { recent: -1, late: 0, week: 1, stale: 2 };
/** 남은 것 순서 (updSort): 이유 → (2주 넘게면 오래된 갱신 순) 마감 순 */
export function updSort(a: UpdItem, b: UpdItem) {
  if (a.why !== b.why) return WHY_N[a.why] - WHY_N[b.why];
  if (a.why === 'stale') return (a.last || '0') < (b.last || '0') ? -1 : (a.last || '0') > (b.last || '0') ? 1 : 0;
  return byEnd(a.t, b.t);
}
/** 내가 입력 책임자인 갱신할 업무 (myUpdList) */
export function myUpdList(me: string, X: UpdInputs): UpdItem[] {
  const idx = updIndex(X);
  const f = updInfoOf(X, idx);
  return X.tasks.map(f).filter((x): x is UpdItem => !!x && x.who === me);
}

/**
 * 5건 묶음 넘기기 (myUpdCard): 넘겨 본 묶음을 순서대로 기억 → [← 이전 5건]으로 돌아갈 수 있음.
 * 새 묶음 = 처음 보는 남은 업무 먼저, 앞 묶음에서 못한 건 맨 뒤로. 입력한 줄은 묶음에 남아 '✓ 갱신함'.
 */
export interface UpdPages { list: string[][]; i: number }
export function updBatch(L: readonly UpdItem[], P: UpdPages): { P: UpdPages; B: string[]; prevLeft: number; rest: number } {
  const byId = new Map(L.map((x) => [x.t.id, x]));
  const left = L.filter((x) => !x.done).sort(updSort);
  const list = P.list.map((b) => [...b]);
  let B = (list[P.i] ?? []).filter((id) => byId.has(id));
  if (!B.length) {
    const seen = new Set(list.slice(0, P.i).flat());
    const pick = [...left.filter((x) => !seen.has(x.t.id)), ...left.filter((x) => seen.has(x.t.id))];
    B = pick.slice(0, 5).map((x) => x.t.id);
    list[P.i] = B;
    list.length = P.i + 1;
  }
  const prevLeft = [...new Set(list.slice(0, P.i).flat())].filter((id) => byId.has(id) && !byId.get(id)!.done && !B.includes(id)).length;
  const rest = left.filter((x) => !B.includes(x.t.id)).length;
  return { P: { list, i: P.i }, B, prevLeft, rest };
}

/** 이번 주에 무엇을 했는지 한 줄 (updWhat): 진행률 변경 · 변동 없음 확인 · 그 밖(티켓 등) */
export function updWhat(t: PmTask, X: Pick<UpdInputs, 'logs' | 'checks' | 'today'>): string {
  const ws = weekStart(X.today);
  const lg = X.logs.filter((x) => x.projectId === t.projectId && x.code === t.code && x.date >= ws && /실적/.test(x.text)).pop();
  if (lg) { const m = lg.text.match(/실적\s*(\d+)%\s*→\s*(\d+)%/); return m ? `${m[1]}% → ${m[2]}%` : '진행률 기록'; }
  if (X.checks.some((c) => c.taskId === t.id && c.date >= ws)) return '변동 없음';
  return '티켓에 기록';
}
