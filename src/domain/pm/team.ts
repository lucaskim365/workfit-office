import { addDays, diffDays, isDone, isLate, liveOf, prioOf, taskPeople, type Live } from './rules';
import type { PmChangeLog, PmProject, PmTask } from './schema';
import { isDrop, isFP, isPre, weekStart } from './site';
import { tkOpen, type PmTicket } from './ticket';

/**
 * 팀 현황 계산 — 대시보드 › 팀 현황 (오늘 · 앞으로 4주 · 투입 시간), 3-4단계.
 * 데모 코드를 그대로 옮긴 순수 함수 (괄호 = 데모 함수·줄, 11/24 데모 기준). DB·화면을 모른다.
 * ([[2026-11-24-pms-port-design]] §5.3)
 *
 * 사람 = 그룹웨어 사용자 ID. 업무에 걸린 사람 = 업무 담당(assigneeIds, 데모 tPeople).
 */

/** 데모 DEV_TEAM_ORG (1447) — 전체 사업을 볼 때 업무가 없어도 카드를 보여 주는 부서 */
export const DEV_TEAM_DEPT = '데이터플랫폼 개발팀';
/** 앞으로 몇 주 (LOAD_WEEKS) */
export const LOAD_WEEKS = 4;
/** 몰림 기준 주당 마감 기본값 (S.loadMax 8) */
export const LOAD_MAX_DEFAULT = 8;

const live = (m: ReadonlyMap<string, Live>, t: PmTask) => m.get(t.id) ?? liveOf(t);
/** 사업 번호 순 (keyNum) */
export const projectNum = (id: string) => Number(id.replace(/\D/g, '')) || 0;

export interface TeamInputs {
  tasks: readonly PmTask[];
  liveMap: ReadonlyMap<string, Live>;
  projects: readonly PmProject[];
  today: string;
}

/** 집계 대상 업무 (workItem 2251) — 협약 이전 · [FP] 줄 · 탈락 사업 제외 */
export function workItemOf(X: Pick<TeamInputs, 'projects'>) {
  const drop = new Set(X.projects.filter(isDrop).map((p) => p.id));
  return (t: PmTask) => !isPre(t) && !isFP(t) && !drop.has(t.projectId);
}
/** 오늘이 업무 기간 안 + 미완료 (tNow 2224 · tStarted 6582) */
export const taskNow = (t: PmTask, l: Live, today: string) => !!t.start && t.start <= today && t.end >= today && !isDone(l);

// ── 오늘 (pTeam 3579) ───────────────────────────────

export interface TeamPersonIn {
  id: string;
  dept: string;
}
export interface TeamRow {
  id: string;
  /** 맡은 미완료 업무 */
  ts: PmTask[];
  doneN: number;
  /** 기간 중 업무, 마감 가까운 순 */
  today: PmTask[];
  /** 진행 중 (= 기간 중 업무 수) */
  period: number;
  late: number;
  /** 7일 내 마감 (지연 제외) */
  week: number;
  /** 급한 일 (지연 · 7일 내 마감 · 진행 중) */
  now: number;
  /** 걸린 사업 (사업 번호 순) */
  ks: string[];
  /** 마지막 업데이트 날짜 ('' = 기록 없음) */
  last: string;
  /** 일주일 넘게 업데이트 없음 (급한 일이 있을 때만) */
  stale: boolean;
}

/**
 * 마지막 업데이트 (lastAct 2337): 변경 이력 · 티켓 처리 중 가장 최근 날짜.
 * 데모는 업무계획(직접 고친 날)·작업일지도 보는데, 그건 3-6·3-7 에서 `more` 로 넣는다.
 */
export function lastActivity(userId: string, logs: readonly PmChangeLog[], tickets: readonly PmTicket[], more: readonly string[] = []): string {
  let d = '';
  for (const x of logs) if (x.by === userId && x.date > d) d = x.date;
  for (const x of tickets) for (const h of x.hist) if (h.by === userId && h.date > d) d = h.date;
  for (const x of more) if (x > d) d = x;
  return d;
}

/**
 * 팀원 카드 (pTeam). 보이는 사람: (전체 사업일 때 개발팀 부서) 또는 맡은 미완료 업무가 있거나 열린 티켓 담당.
 * 정렬: 지연 많은 순 → 급한 일 많은 순.
 */
export function teamRows(people: readonly TeamPersonIn[], X: TeamInputs & { tickets: readonly PmTicket[]; logs: readonly PmChangeLog[]; lastMore?: (id: string) => string[] }, k: string): TeamRow[] {
  const { liveMap, today } = X;
  const wi = workItemOf(X);
  const inK = (t: { projectId: string }) => k === 'all' || t.projectId === k;
  const work = X.tasks.filter((t) => wi(t) && inK(t));
  const by = new Map<string, PmTask[]>();
  for (const t of work) if (!isDone(live(liveMap, t))) for (const n of taskPeople(t)) { const a = by.get(n) ?? []; a.push(t); by.set(n, a); }
  const w7 = addDays(today, 7);
  const rows = people
    .filter((u) => (k === 'all' && u.dept === DEV_TEAM_DEPT) || by.has(u.id) || X.tickets.some((x) => tkOpen(x) && x.assigneeId === u.id && inK(x)))
    .map((u): TeamRow => {
      const ts = by.get(u.id) ?? [];
      const L = (t: PmTask) => live(liveMap, t);
      const doneN = work.filter((t) => isDone(L(t)) && taskPeople(t).includes(u.id)).length;
      const todayL = ts.filter((t) => taskNow(t, L(t), today)).sort((a, b) => ((a.end || '') < (b.end || '') ? -1 : 1));
      const late = ts.filter((t) => isLate(t, L(t), today)).length;
      const now = ts.filter((t) => { const p = prioOf(t, L(t), today); return p === '지연' || p === '7일 내 마감' || p === '진행 중'; }).length;
      const last = lastActivity(u.id, X.logs, X.tickets, X.lastMore?.(u.id) ?? []);
      return {
        id: u.id, ts, doneN, today: todayL, period: todayL.length, late,
        week: ts.filter((t) => !isLate(t, L(t), today) && !!t.end && t.end <= w7).length,
        now,
        ks: [...new Set(ts.map((t) => t.projectId))].sort((a, b) => projectNum(a) - projectNum(b)),
        last,
        stale: now > 0 && (!last || diffDays(last, today) > 7),
      };
    });
  return rows.sort((a, b) => b.late - a.late || b.now - a.now);
}

// ── 사람별 업무 팝업 (personModal 6584) ──────────────

/** 팝업 탭 (PTABS 6579). '7일 내 마감'은 카드 숫자를 눌렀을 때 그 목록이 나오게 더함 (0.1 규칙 2) */
export const PERSON_TABS = [['all', '맡은 업무'], ['now', '진행 중'], ['late', '지연'], ['week', '7일 내 마감'], ['done', '완료']] as const;
export type PersonTab = (typeof PERSON_TABS)[number][0];

export function personTabOk(tab: PersonTab, t: PmTask, l: Live, today: string): boolean {
  if (tab === 'now') return taskNow(t, l, today);
  if (tab === 'late') return isLate(t, l, today);
  if (tab === 'done') return isDone(l);
  if (tab === 'week') return !isDone(l) && !isLate(t, l, today) && !!t.end && t.end <= addDays(today, 7);
  return !isDone(l);
}

const PRIO_N = { 지연: 0, '7일 내 마감': 1, '진행 중': 2, 예정: 3, 완료: 4 } as const;

/** 사람의 업무 목록: 탭 숫자 · 사업별 숫자 · 목록(완료 = 최근 종료일 순, 그 외 급한 순) */
export function personTasks(userId: string, X: TeamInputs, k: string, tab: PersonTab) {
  const { liveMap, today } = X;
  const wi = workItemOf(X);
  const L = (t: PmTask) => live(liveMap, t);
  const pool = X.tasks.filter((t) => wi(t) && taskPeople(t).includes(userId));
  const inK = pool.filter((t) => k === 'all' || t.projectId === k);
  const inTab = pool.filter((t) => personTabOk(tab, t, L(t), today));
  const list = inK.filter((t) => personTabOk(tab, t, L(t), today)).sort(
    tab === 'done'
      ? (a, b) => ((a.end || '') < (b.end || '') ? 1 : -1)
      : (a, b) => PRIO_N[prioOf(a, L(a), today)] - PRIO_N[prioOf(b, L(b), today)] || ((a.end || '9') < (b.end || '9') ? -1 : 1),
  );
  const counts = Object.fromEntries(PERSON_TABS.map(([id]) => [id, inK.filter((t) => personTabOk(id, t, L(t), today)).length])) as Record<PersonTab, number>;
  const byK = new Map<string, number>();
  for (const t of inTab) byK.set(t.projectId, (byK.get(t.projectId) ?? 0) + 1);
  const ks = [...byK.keys()].sort((a, b) => projectNum(a) - projectNum(b));
  return { list, counts, byK, ks, total: inTab.length };
}
/** [업무 목록에서 보기] 로 갈 때의 기간·상태 (teamGo wb) */
export const PERSON_WBS: Record<PersonTab, { period: 'all' | 'now' | 'late'; st: 'open' | '완료' }> = {
  all: { period: 'all', st: 'open' }, now: { period: 'now', st: 'open' }, late: { period: 'late', st: 'open' }, week: { period: 'all', st: 'open' }, done: { period: 'all', st: '완료' },
};

// ── 앞으로 4주 (loadWeeks 4131 · schedLoad 4164) ─────

export interface LoadWeek { s: string; e: string }
export interface LoadRow {
  /** 주마다 그 주에 '마감되는' 미완료 업무 수 */
  w: number[];
  /** 주마다 그 주에 기간이 걸친 업무 수 (말풍선) */
  run: number[];
  /** 사업 → 주별 마감 수 */
  by: Map<string, number[]>;
  /** 이미 마감이 지난 업무 (주별 칸에 안 넣음) */
  late: number;
  ks: Set<string>;
}

/**
 * 사람별 앞으로 4주 업무량. 날짜(시작·종료)가 다 있는 미완료 집계 대상 업무만.
 * 지연 업무는 주별 칸에 넣지 않고 '지연'에 따로 셈.
 */
export function loadWeeks(X: TeamInputs): { ws: LoadWeek[]; m: Map<string, LoadRow> } {
  const { liveMap, today } = X;
  const ws = Array.from({ length: LOAD_WEEKS }, (_, i) => { const s = weekStart(today, i); return { s, e: addDays(s, 6) }; });
  const m = new Map<string, LoadRow>();
  const get = (n: string) => { let r = m.get(n); if (!r) { r = { w: ws.map(() => 0), run: ws.map(() => 0), by: new Map(), late: 0, ks: new Set() }; m.set(n, r); } return r; };
  const wi = workItemOf(X);
  for (const t of X.tasks) {
    const l = live(liveMap, t);
    if (isDone(l) || !wi(t) || !t.start || !t.end) continue;
    if (isLate(t, l, today)) { for (const n of taskPeople(t)) get(n).late++; continue; }
    ws.forEach((w, i) => {
      if (!(t.start <= w.e && t.end >= w.s)) return;
      const due = t.end <= w.e;
      for (const n of taskPeople(t)) {
        const r = get(n);
        r.run[i]++;
        r.ks.add(t.projectId);
        if (due) { r.w[i]++; const b = r.by.get(t.projectId) ?? ws.map(() => 0); b[i]++; r.by.set(t.projectId, b); }
      }
    });
  }
  return { ws, m };
}

/** 칸 색·글자 (loadCell 4140) */
export function loadCell(n: number, max: number): { lv: 'none' | 'low' | 'mid' | 'full' | 'over'; text: string; pct: number } {
  if (!n) return { lv: 'none', text: '마감 없음', pct: 0 };
  const lv = n > max ? 'over' : n === max ? 'full' : n >= Math.ceil(max * 0.6) ? 'mid' : 'low';
  const text = n > max ? `마감 ${n}건 · ${n - max}건 초과` : n === max ? `마감 ${n}건 · 꽉 참` : `마감 ${n}건`;
  return { lv, text, pct: Math.min(100, (n / max) * 100) };
}

/** 표 순서: 이번 주 마감 많은 순 → 다음 주 (loadWeeksCard) */
export function loadOrder(ids: readonly string[], m: ReadonlyMap<string, LoadRow>): string[] {
  return ids.filter((id) => m.has(id)).sort((a, b) => m.get(b)!.w[0] - m.get(a)!.w[0] || m.get(b)!.w[1] - m.get(a)!.w[1]);
}

export interface Reassign {
  id: string;
  row: LoadRow;
  /** 이번 주 + 다음 주 마감이 가장 많은 사업 */
  top: { projectId: string; n: number } | null;
  /** 같은 사업 참여자 중 2주 마감이 가장 적은 사람 */
  cand: { id: string; due2: number } | null;
}
/**
 * 재배정 검토 대상 (schedLoad): 이번 주나 다음 주 마감이 주당 기준을 넘는 사람, 2주 마감 많은 순.
 * 넘겨받을 사람 = 같은 사업 업무에 걸린 다른 사람 중 2주 마감이 가장 적은 사람.
 */
export function reassignList(ids: readonly string[], W: ReadonlyMap<string, LoadRow>, max: number, tasks: readonly PmTask[]): Reassign[] {
  const due2 = (n: string) => { const r = W.get(n); return r ? r.w[0] + r.w[1] : 0; };
  return ids
    .filter((id) => { const r = W.get(id); return !!r && (r.w[0] > max || r.w[1] > max); })
    .sort((a, b) => due2(b) - due2(a))
    .map((id) => {
      const row = W.get(id)!;
      const top = [...row.by.entries()].map(([projectId, b]) => ({ projectId, n: b[0] + b[1] })).filter((x) => x.n).sort((a, b) => b.n - a.n)[0] ?? null;
      const cand = top
        ? ids.filter((v) => v !== id && tasks.some((t) => t.projectId === top.projectId && taskPeople(t).includes(v))).map((v) => ({ id: v, due2: due2(v) })).sort((a, b) => a.due2 - b.due2)[0] ?? null
        : null;
      return { id, row, top, cand };
    });
}

// ── 투입 시간 (pHours 8299) ─────────────────────────

/** 업무계획 '시간' 칸에 적은 1건 (hoursRows) — 업무계획은 3-6 에서 옮김 */
export interface HourRow {
  who: string;
  /** 날짜 */
  d: string;
  h: number;
  /** 업무에 연결됐으면 그 사업, 아니면 '' (사내 · 기타) */
  projectId: string;
  txt: string;
}
export const HOUR_PERIODS = [['week', '이번 주'], ['lastweek', '지난주'], ['month', '이번 달'], ['m3', '최근 90일']] as const;
export type HourPeriod = (typeof HOUR_PERIODS)[number][0];

export function hourRange(per: HourPeriod, today: string): [string, string, string] {
  const ws = weekStart(today);
  if (per === 'lastweek') return [addDays(ws, -7), addDays(ws, -1), '지난주'];
  if (per === 'month') return [`${today.slice(0, 8)}01`, today, '이번 달'];
  if (per === 'm3') return [addDays(today, -90), today, '최근 90일'];
  return [ws, addDays(ws, 6), '이번 주'];
}
/** 시간 글자 "3.5h" (hTxt) */
export const hourText = (h: number) => (h ? `${+h}h` : '');

export function hourSummary(all: readonly HourRow[], from: string, to: string) {
  const R = all.filter((r) => r.h && r.d >= from && r.d <= to);
  const sum = (f: (r: HourRow) => boolean) => R.filter(f).reduce((a, r) => a + r.h, 0);
  // 사업 번호 순, 사내 · 기타('')는 맨 뒤
  const ks = [...new Set(R.map((r) => r.projectId))].sort((a, b) => (a ? projectNum(a) : 1e9) - (b ? projectNum(b) : 1e9));
  const whos = [...new Set(R.map((r) => r.who))];
  const ppl = whos.map((w) => ({ w, h: sum((r) => r.who === w), days: new Set(R.filter((r) => r.who === w).map((r) => r.d)).size })).sort((a, b) => b.h - a.h);
  const byK = ks.map((k) => ({ k, h: sum((r) => r.projectId === k) }));
  const top = [...byK].sort((a, b) => b.h - a.h)[0] ?? null;
  return { R, ks, whos, ppl, total: sum(() => true), top, sum };
}
