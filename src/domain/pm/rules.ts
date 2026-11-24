import type { PmBaseline, PmChangeLog, PmProject, PmTask, PmTaskDone, PmTaskStatus } from './schema';

/**
 * 업무 목록 계산·판정 규칙 — 데모 코드를 그대로 옮긴 순수 함수. DB·화면을 모른다.
 * 규칙 표와 이유: [[2026-11-24-pms-port-design]] §3.3. 괄호 = 데모 함수(줄 번호는 11/24 데모 기준).
 *
 * 모든 함수는 오늘 날짜(`today`, 'YYYY-MM-DD')를 받는다 — 테스트에서 날짜를 고정하려고.
 */

// ── 날짜 ─────────────────────────────────────────────

const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 오늘 'YYYY-MM-DD' (로컬 시간) */
export const todayStr = () => fmt(new Date());
export const addDays = (s: string, n: number) => {
  const d = toDate(s);
  d.setDate(d.getDate() + n);
  return fmt(d);
};
/** b − a 일수 (데모 diff) */
export const diffDays = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
/** 'M/D' (데모 md) */
export const monthDay = (s: string) => (s ? `${+s.slice(5, 7)}/${+s.slice(8, 10)}` : '-');
/** 'YY.MM' (데모 ym) */
export const yearMonth = (s: string) => (s ? s.slice(2, 7).replace('-', '.') : '-');
/** "N일 경과" / "오늘 마감" / "N일 남음" (데모 leftTxt) */
export function leftText(end: string, today: string) {
  const n = diffDays(today, end);
  return n < 0 ? `${-n}일 경과` : n === 0 ? '오늘 마감' : `${n}일 남음`;
}

// ── 업무 1건 ──────────────────────────────────────────

/** 티켓 — 2단계에서 채운다. 1단계는 티켓 0건 */
export interface PmTicketLike {
  taskId: string;
  status: '발행' | '접수' | '진행중' | '검토요청' | '완료' | '보류' | '취소';
  prog: number;
}

export interface Live {
  status: PmTaskStatus;
  pct: number;
}

/** 업무 상태·실적 — 티켓 반영 (wbsLive 1556). 묶음 줄(bb=2)은 새 업무 목록에 없어 옮기지 않음 */
export function liveOf(t: PmTask, ticket?: PmTicketLike): Live {
  if (!ticket || ticket.status === '취소') return { status: t.actualPct >= 100 ? '완료' : t.status, pct: t.actualPct };
  if (ticket.status === '완료') return { status: '완료', pct: 100 };
  const pct = Math.max(t.actualPct, ticket.prog);
  if (ticket.status === '접수' || ticket.status === '진행중' || ticket.status === '검토요청') return { status: '진행중', pct };
  return { status: pct >= 100 ? '완료' : t.status, pct };
}

export const isDone = (l: Live) => l.status === '완료' || l.pct >= 100;
/** 지연 = 종료 < 오늘 이고 완료 아님 (tLate 2223) */
export const isLate = (t: PmTask, l: Live, today: string) => !!t.end && t.end < today && !isDone(l);

/** 기본 담당 = 첫 담당자 (defaultAssignee 1533: 개발 담당 → 실행 담당 첫 사람). 없으면 '' */
export const defaultAssignee = (t: PmTask) => t.assigneeIds[0] ?? '';
/** 업무에 걸린 사람 전부 (tPeople) */
export const taskPeople = (t: PmTask) => [...new Set(t.assigneeIds.filter(Boolean))];

/** 우선순위 표시 (prioOf): 지연 > 7일 내 마감 > 진행 중 > 예정 */
export type PmPrio = '지연' | '7일 내 마감' | '진행 중' | '예정' | '완료';
export function prioOf(t: PmTask, l: Live, today: string): PmPrio {
  if (isDone(l)) return '완료';
  if (isLate(t, l, today)) return '지연';
  if (t.end && t.end >= today && t.end <= addDays(today, 7)) return '7일 내 마감';
  if (t.start && t.start <= today && t.end >= today) return '진행 중';
  return '예정';
}

// ── 완료 기록 ─────────────────────────────────────────

export interface DoneInfo {
  date: string;
  by: string;
  prevPct: number | null;
  /** 티켓 승인으로 끝났으면 티켓 번호 (2단계) */
  ticketNo?: string;
}

/**
 * 언제·누가 완료했나 (doneInfo 2299): 직접 완료 기록 → TASK 티켓 승인 이력 → 변경 이력의 "→100%".
 * 엑셀에서 완료로 들어온 건 날짜 없음 → {date:''}. 완료가 아니면 null.
 */
export function doneInfoOf(t: PmTask, l: Live, records: ReadonlyMap<string, PmTaskDone>, logs: readonly PmChangeLog[]): DoneInfo | null {
  if (!isDone(l)) return null;
  const r = records.get(t.id);
  if (r) return { date: r.date, by: r.by, prevPct: r.prevPct };
  const lg = [...logs].reverse().find((x) => x.projectId === t.projectId && x.code === t.code && /→\s*100(%|\b)/.test(x.text));
  if (lg) {
    const m = lg.text.match(/(\d+)%?\s*→\s*100/);
    return { date: lg.date, by: lg.by, prevPct: m ? +m[1] : null };
  }
  return { date: '', by: '', prevPct: null };
}

/**
 * 진행률 입력 → 상태 (quickAp 2280대): ≥100 완료 · >0 진행중 · 0이면 (완료였으면 진행중, 아니면 그대로).
 * 100이 될 때 완료 기록을 남기고, 100 밑으로 내려가면 지운다.
 */
export function applyProgress(t: PmTask, pct: number, today: string, by: string): {
  status: PmTaskStatus;
  pct: number;
  done: PmTaskDone | null | 'remove';
  log: string;
} {
  const old = t.actualPct || 0;
  const status: PmTaskStatus = pct >= 100 ? '완료' : pct > 0 ? '진행중' : t.status === '완료' ? '진행중' : t.status;
  const done = pct >= 100 && old < 100 ? { id: t.id, date: today, by, prevPct: old } : pct < 100 ? 'remove' as const : null;
  return { status, pct, done, log: `실적 ${old}% → ${pct}%` };
}

/** 완료 취소 (taskUndo): 완료 전 %로 (모르면 90%) */
export const undoPct = (info: DoneInfo) => (info.prevPct != null && info.prevPct < 100 ? info.prevPct : 90);

// ── 묶음·가중 평균 ────────────────────────────────────

const mdW = (t: PmTask) => (t.md ? +t.md : 1);

/** 업무 실적%를 MD 가중 평균, MD 없으면 1건 = 1 — 반올림 안 함 (stats 2349 · 카드 avg 1665 의 반올림 전 값) */
export function mdAvgRaw(ts: readonly PmTask[], liveMap: ReadonlyMap<string, Live>): number {
  const pool = ts.filter((t) => !t.excludeFromProgress);
  const w = pool.reduce((a, t) => a + mdW(t), 0);
  return w ? pool.reduce((a, t) => a + mdW(t) * (liveMap.get(t.id)?.pct ?? t.actualPct), 0) / w : 0;
}
/** 카드 표시용 — 정수 반올림 (pWbs avg 1665) */
export const mdAvg = (ts: readonly PmTask[], liveMap: ReadonlyMap<string, Live>) => Math.round(mdAvgRaw(ts, liveMap));
/** MD 합 — md 없는 건 0으로 더함 (묶음 카드 1755) */
export const mdSum = (ts: readonly PmTask[]) => ts.reduce((a, t) => a + (t.md ? +t.md : 0), 0);

/** 업무 날짜 최소~최대 (span) */
export function spanOf(ts: readonly PmTask[]): [string, string] {
  const s = ts.map((t) => t.start).filter(Boolean).sort();
  const e = ts.map((t) => t.end).filter(Boolean).sort();
  return [s[0] ?? '', e[e.length - 1] ?? ''];
}

/** 기간 경과율 "기간 N% 지남" (tPct 1668): (오늘−시작)/(종료−시작)×100, 0~100. 날짜 없으면 null */
export function timePct(start: string, end: string, today: string): number | null {
  if (!start || !end) return null;
  return Math.max(0, Math.min(100, Math.round((diffDays(start, today) / Math.max(1, diffDays(start, end))) * 100)));
}

export interface StageSum {
  stage: string;
  tasks: PmTask[];
  n: number;
  /** MD 가중, 반올림 */
  pct: number;
  late: number;
  allDone: boolean;
  start: string;
  end: string;
}

/** 단계별 묶음 (stagesOf) — 같은 단계 안 순서는 원래 순서 */
export function stagesOf(ts: readonly PmTask[], liveMap: ReadonlyMap<string, Live>, today: string): StageSum[] {
  const order: string[] = [];
  for (const t of ts) if (!order.includes(t.stage)) order.push(t.stage);
  return order.map((stage) => {
    const g = ts.filter((t) => t.stage === stage);
    const [start, end] = spanOf(g);
    const lv = (t: PmTask) => liveMap.get(t.id) ?? liveOf(t);
    return {
      stage,
      tasks: g,
      n: g.length,
      pct: mdAvg(g, liveMap),
      late: g.filter((t) => isLate(t, lv(t), today)).length,
      allDone: g.every((t) => isDone(lv(t))),
      start,
      end,
    };
  });
}

/**
 * 지금 업무 (curOf 1670): 다 끝나지 않았고 시작일이 오늘 이전인 단계 중 마지막,
 * 없으면 안 끝난 첫 단계. 다 끝났으면 null ("모든 단계 완료").
 */
export function currentStage(sg: readonly StageSum[], today: string): StageSum | null {
  const started = sg.filter((x) => !x.allDone && x.start && x.start <= today);
  return started[started.length - 1] ?? sg.find((x) => !x.allDone) ?? null;
}

export interface GroupSum {
  group: string;
  n: number;
  md: number;
  pct: number;
  done: number;
}

/** 묶음 진행률 (pWbs G 1755): grp(없으면 단계)별 MD 가중·반올림, MD 합은 md 없는 건 0 */
export function groupsOf(ts: readonly PmTask[], liveMap: ReadonlyMap<string, Live>): GroupSum[] {
  const key = (t: PmTask) => t.group || t.stage;
  const order: string[] = [];
  for (const t of ts) if (!order.includes(key(t))) order.push(key(t));
  return order.map((group) => {
    const g = ts.filter((t) => key(t) === group);
    return {
      group,
      n: g.length,
      md: mdSum(g),
      pct: mdAvg(g, liveMap),
      done: g.filter((t) => isDone(liveMap.get(t.id) ?? liveOf(t))).length,
    };
  });
}

// ── 사업 카드 ─────────────────────────────────────────

export interface ProjectCard {
  /** 업무 수 */
  n: number;
  /** 카드 진행률 (정수) */
  pct: number;
  /** 반올림 전 (테스트·통합 현황용) */
  pctRaw: number;
  late: number;
  start: string;
  end: string;
  timePct: number | null;
  stages: StageSum[];
  current: StageSum | null;
  /** 진행 중 = 미완료 · 시작 ≤ 오늘 ≤ 종료 */
  now: number;
  /** 7일 내 마감 = 미완료 · 오늘 ≤ 종료 ≤ 오늘+7 */
  due7: number;
  /** 담당 없음 = 미완료 · 기본 담당 비어 있음 */
  noAssignee: number;
  mdTotal: number;
}

/** 사업 카드 (pcard 1723). 업무 0건이면 n=0 → 화면은 "-" + "업무 목록 작성 전" */
export function projectCard(p: PmProject, ts: readonly PmTask[], liveMap: ReadonlyMap<string, Live>, today: string): ProjectCard {
  const lv = (t: PmTask) => liveMap.get(t.id) ?? liveOf(t);
  const [s0, e0] = spanOf(ts);
  const start = p.start || s0;
  const end = p.end || e0;
  const stages = stagesOf(ts, liveMap, today);
  const t7 = addDays(today, 7);
  const open = ts.filter((t) => !isDone(lv(t)));
  return {
    n: ts.length,
    pct: ts.length ? mdAvg(ts, liveMap) : 0,
    pctRaw: ts.length ? mdAvgRaw(ts, liveMap) : 0,
    late: ts.filter((t) => isLate(t, lv(t), today)).length,
    start,
    end,
    timePct: timePct(start, end, today),
    stages,
    current: currentStage(stages, today),
    now: open.filter((t) => t.start && t.start <= today && t.end >= today).length,
    due7: open.filter((t) => t.end && t.end >= today && t.end <= t7).length,
    noAssignee: open.filter((t) => !defaultAssignee(t)).length,
    mdTotal: mdSum(ts),
  };
}

// ── 목록 거르기 ───────────────────────────────────────

export type PmPeriod = 'now' | 'soon' | 'late' | 'rec' | 'done' | 'all';
export const PM_PERIOD_TABS: ReadonlyArray<readonly [PmPeriod, string]> = [
  ['now', '진행 중'],
  ['soon', '2주 내 시작'],
  ['late', '지연'],
  ['rec', '발행 추천'],
  ['done', '최근 완료'],
  ['all', '전체'],
];

export interface PmFilter {
  /** 사업 ('all' = 전체) */
  projectId: string;
  /** 단계·묶음 ('all') */
  stage: string;
  period: PmPeriod;
  /** 'open' = 미완료 · 'all' · 상태 하나 */
  st: 'open' | 'all' | PmTaskStatus;
  /** 'all' · '__none'(담당 지정 필요) · 사용자 ID */
  who: string;
  /** 내 업무만 — 로그인한 사람 ID */
  mine: string;
  milestoneOnly: boolean;
  q: string;
}

export const PM_FILTER_DEFAULT: PmFilter = {
  projectId: 'all', stage: 'all', period: 'all', st: 'open', who: 'all', mine: '', milestoneOnly: false, q: '',
};

export interface FilterCtx {
  today: string;
  liveMap: ReadonlyMap<string, Live>;
  /** 티켓 걸린 업무 (1단계는 빈 집합) */
  ticketed: ReadonlySet<string>;
  doneInfo: (t: PmTask) => DoneInfo | null;
  /** 담당 이름 (검색용) */
  nameOf?: (userId: string) => string;
}

/** 업무 목록 거르기 (wbsFiltered 1605) */
export function filterTasks(ts: readonly PmTask[], f: PmFilter, c: FilterCtx): PmTask[] {
  const { today } = c;
  const t7 = addDays(today, 7);
  const t14 = addDays(today, 14);
  const q = f.q.trim().toLowerCase();
  return ts.filter((t) => {
    const l = c.liveMap.get(t.id) ?? liveOf(t);
    const done = isDone(l);
    const issued = c.ticketed.has(t.id);
    if (f.projectId !== 'all' && t.projectId !== f.projectId) return false;
    if (f.stage !== 'all' && (t.group || t.stage) !== f.stage && t.stage !== f.stage) return false;
    // 최근 완료: 2주 안 완료 (상태 필터 무시)
    if (f.period === 'done') {
      if (!done) return false;
      const di = c.doneInfo(t);
      if (!di || !di.date || di.date < addDays(today, -14)) return false;
    } else if (f.st === 'open' ? done : f.st !== 'all' && l.status !== f.st) return false;
    if (f.milestoneOnly && !t.milestone) return false;
    if (f.who === '__none' ? !!defaultAssignee(t) : f.who !== 'all' && !t.assigneeIds.includes(f.who)) return false;
    if (f.mine && !taskPeople(t).includes(f.mine)) return false;
    const p = f.period;
    // 진행 중: 시작 ≤ 오늘 ≤ 종료 — 완료 여부는 안 봄 (상태 필터가 따로 거름)
    if (p === 'now' && !(t.start && t.start <= today && t.end >= today)) return false;
    if (p === 'soon' && !(t.start > today && t.start <= t14)) return false;
    if (p === 'late' && !(t.end && t.end < today && !done)) return false;
    // 발행 추천: 미완료 · 티켓 없음 · 시작 있음 · 시작 ≤ 오늘+7 (이미 시작한 것 포함)
    if (p === 'rec' && !(!done && !issued && t.start && t.start <= t7)) return false;
    if (q) {
      const who = c.nameOf ? t.assigneeIds.map(c.nameOf).join(' ') : '';
      const hay = `${t.name} ${t.code} ${t.output} ${t.execMemo} ${who} ${t.group} ${t.memo}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * 탭 숫자 (pWbs cnt 1645): 보드 보기이거나 (사업·단계를 고르고 상태 '미완료')면 상태 무관으로 셈
 * → 탭 숫자 = 보드 카드 수.
 */
export function countsAllStatus(f: PmFilter, board: boolean) {
  return board || (f.projectId !== 'all' && f.stage !== 'all' && f.st === 'open');
}
export function tabCounts(ts: readonly PmTask[], f: PmFilter, c: FilterCtx, board: boolean): Record<PmPeriod, number> {
  const all = countsAllStatus(f, board);
  const out = {} as Record<PmPeriod, number>;
  for (const [p] of PM_PERIOD_TABS) out[p] = filterTasks(ts, { ...f, period: p, ...(all ? { st: 'all' as const } : {}) }, c).length;
  return out;
}

// ── 사업 상태 (대시보드용, 3단계에서 화면에 씀) ─────────

/** 계획% (planP 2218) — 업무별 (시작~오늘+1)/(시작~종료+1), 양 끝 날 포함. tPct 와 식이 다르다 */
export function planPct(t: PmTask, today: string): number {
  if (!t.start || !t.end) return 0;
  if (t.start === t.end) return today >= t.end ? 100 : 0;
  return Math.max(0, Math.min(1, (diffDays(t.start, today) + 1) / (diffDays(t.start, t.end) + 1))) * 100;
}

export type PmSiteStatus = '종료' | '준비' | '완료' | '착수 전' | '지연' | '소폭지연' | '선행' | '정상';

/** 사업 상태 (siteStatus 2370). 엑셀 상태 칸 '지연'은 안 씀 — 오늘 기준으로 다시 판정 */
export function siteStatus(p: PmProject, ts: readonly PmTask[], liveMap: ReadonlyMap<string, Live>, today: string): PmSiteStatus {
  if (p.closed) return '종료';
  const pool = ts.filter((t) => !t.excludeFromProgress);
  if (!pool.length) return '준비';
  const act = mdAvgRaw(pool, liveMap);
  const w = pool.reduce((a, t) => a + mdW(t), 0);
  const plan = pool.reduce((a, t) => a + mdW(t) * planPct(t, today), 0) / w;
  if (act >= 100) return '완료';
  if (plan <= 0) return '착수 전';
  const gap = act - plan;
  if (gap <= -10) return '지연';
  if (gap < 0) return '소폭지연';
  if (gap >= 5) return '선행';
  return '정상';
}

// ── 기준선 ────────────────────────────────────────────

/** 기준선 만들기 (setBaseline 2162) */
export function makeBaseline(projectId: string, ts: readonly PmTask[], label: string, today: string, by: string): PmBaseline {
  const map: PmBaseline['map'] = {};
  for (const t of ts) map[t.id] = { start: t.start, end: t.end, code: t.code, name: t.name };
  return { id: projectId, date: today, by, label, map };
}

export type VarKind = 'late' | 'early' | 'add' | 'del';
export interface VarRow {
  kind: VarKind;
  projectId: string;
  taskId?: string;
  code: string;
  name: string;
  from?: string;
  to?: string;
  /** 차이 일수 (+ = 늦춰짐) */
  d?: number;
}
export interface Variance {
  baseline: PmBaseline;
  late: number;
  early: number;
  added: number;
  removed: number;
  baseEnd: string;
  curEnd: string;
  endDiff: number;
  rows: VarRow[];
}

/** 기준선 대비 변동 (baseVar 2169): 종료일이 바뀐 업무 · 추가 · 삭제, 마지막 업무 종료 변화 */
export function varianceOf(b: PmBaseline, ts: readonly PmTask[]): Variance {
  const rows: VarRow[] = [];
  for (const t of ts) {
    const o = b.map[t.id];
    if (!o) {
      rows.push({ kind: 'add', projectId: t.projectId, taskId: t.id, code: t.code, name: t.name, to: t.end });
      continue;
    }
    const d = o.end && t.end ? diffDays(o.end, t.end) : 0;
    if (d) rows.push({ kind: d > 0 ? 'late' : 'early', projectId: t.projectId, taskId: t.id, code: t.code, name: t.name, from: o.end, to: t.end, d });
  }
  const now = new Set(ts.map((t) => t.id));
  for (const [id, o] of Object.entries(b.map)) {
    if (!now.has(id)) rows.push({ kind: 'del', projectId: b.id, code: o.code, name: o.name || '(이름 없음 · 이전 기준선)', from: o.end });
  }
  const ord: Record<VarKind, number> = { late: 0, add: 1, del: 2, early: 3 };
  rows.sort((a, c) => ord[a.kind] - ord[c.kind] || (c.d ?? 0) - (a.d ?? 0));
  const baseEnd = Object.values(b.map).reduce((a, x) => (x.end > a ? x.end : a), '');
  const curEnd = ts.reduce((a, t) => (t.end > a ? t.end : a), '');
  return {
    baseline: b,
    late: rows.filter((r) => r.kind === 'late').length,
    early: rows.filter((r) => r.kind === 'early').length,
    added: rows.filter((r) => r.kind === 'add').length,
    removed: rows.filter((r) => r.kind === 'del').length,
    baseEnd,
    curEnd,
    endDiff: baseEnd && curEnd ? diffDays(baseEnd, curEnd) : 0,
    rows,
  };
}

// ── 이름 ──────────────────────────────────────────────

const CO_SHORT: Record<string, string> = {
  P1: '에이스', P2: '신광', P3: '효광', P4: '한일', P5: '꽃샘', P6: '저스템', P7: '효광',
  P8: '만도', P9: '삼광', P10: '은혜', P11: 'A&P', P12: '금호', P13: '광우',
};
const coBase = (p: PmProject) => p.short || CO_SHORT[p.id] || p.company.replace(/㈜|\(주\)|주식회사/g, '').trim().slice(0, 2) || p.id;
const bizTag = (p: PmProject) => (/AI/i.test(p.biz) ? 'AI' : p.biz.replace(/\s*\(.*$/, '').trim());

/**
 * 사업 줄인 이름 (coShort 2394): 같은 업체가 사업을 여럿 할 때만 (사업유형)을 붙임 — 예: 효광 / 효광(AI).
 * 부처협업형은 그냥 업체명.
 */
export function shortName(p: PmProject, all: readonly PmProject[]): string {
  const base = coBase(p);
  if (!all.some((x) => x.id !== p.id && coBase(x) === base) || /부처협업/.test(p.biz)) return base;
  return `${base}(${bizTag(p)})`;
}

/** 이름에서 직급 떼기 — "박명규 부장" → "박명규" (§4.4) */
export const stripTitle = (s: string) => s.trim().split(/\s+/)[0] ?? '';
