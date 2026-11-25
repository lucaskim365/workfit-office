import { addDays, diffDays, isDone, isLate, liveOf, monthDay, taskPeople, type Live } from './rules';
import type { PmAction, PmLater, PmPdfDraft, PmPlanDay, PmPlanItem, PmPlanRep, PmProject, PmSubtask, PmTask } from './schema';
import { taskNow, workItemOf, type HourRow } from './team';
import { tkOpen, tkReviewPending, type PmTicket } from './ticket';
import { tkRevWho } from './my';

/**
 * 업무계획 (데모 plan* 5097~5571) — 3-6단계. 데모 규칙 그대로, 사람 = 사용자 ID.
 *
 * - 2주치(이번 주 · 다음 주 평일) 계획. 고친 날은 저장된 그대로, 안 고친 날은 **자동 초안**
 *   (반복 업무 + 어제 남은 일(오늘만) + 그날 예정인 내 세부 작업 + 그날이 기간 안인 내 업무 하루 3개, 날마다 돌아가며).
 * - 고치는 순간(체크 · 추가 · 삭제 · 시간 · 메모) 그날은 저장되고 자동 표시가 떨어진다 (planMut).
 * - 추천은 넣지 않고 보여 주기만 — 오늘 꼭 / 나를 기다리는 일 / 이번 주 안에 / 지연 업무.
 */

export const PLAN_N = 3;
export const HOURS = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8] as const;
export const PCTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
export const WD = '일월화수목금토';

const dow = (d: string) => new Date(`${d}T00:00:00`).getDay();
export const isWeekend = (d: string) => dow(d) === 0 || dow(d) === 6;
export const prevWorkday = (d: string) => { let p = addDays(d, -1); while (isWeekend(p)) p = addDays(p, -1); return p; };
export const nextWorkday = (d: string) => { let p = addDays(d, 1); while (isWeekend(p)) p = addDays(p, 1); return p; };
export const dayLabel = (d: string) => `${monthDay(d)} (${WD[dow(d)]})`;
export const wdOf = dow;

/** 이번 주 · 다음 주 평일 (planWeeks) */
export function planWeeks(today: string): string[][] {
  const mon = addDays(today, -((dow(today) + 6) % 7));
  return [0, 1].map((w) => [0, 1, 2, 3, 4].map((i) => addDays(mon, w * 7 + i)));
}

export interface PlanInputs {
  today: string;
  tasks: readonly PmTask[];
  liveMap: ReadonlyMap<string, Live>;
  projects: readonly PmProject[];
  subtasks: readonly PmSubtask[];
  plans: readonly PmPlanDay[];
  reps: readonly PmPlanRep[];
  later: readonly PmLater[];
  tickets: readonly PmTicket[];
  actions: readonly PmAction[];
  drafts: readonly PmPdfDraft[];
  /** 어제 남은 일이 자동으로 넘어오기 시작하는 날 (S.carryFrom). 비면 오늘 다음 근무일 */
  carryFrom: string;
}

/** 계산 도구 묶음 — 화면마다 한 번 만든다 */
export interface PlanCtx {
  X: PlanInputs;
  today: string;
  task: (id: string | undefined) => PmTask | undefined;
  live: (t: PmTask) => Live;
  done: (t: PmTask) => boolean;
  late: (t: PmTask) => boolean;
  sub: (it: { taskId?: string; subId?: string }) => PmSubtask | undefined;
  saved: (who: string, d: string) => PmPlanItem[] | undefined;
  draft: (who: string, d: string) => PmPdfDraft | undefined;
  /** 사람별 저장된 날 (날짜 → 항목) */
  savedDays: (who: string) => ReadonlyArray<readonly [string, PmPlanItem[]]>;
}

export function planCtx(X: PlanInputs): PlanCtx {
  const taskMap = new Map(X.tasks.map((t) => [t.id, t]));
  const subMap = new Map(X.subtasks.filter((s) => !s.legacyKey).map((s) => [s.id, s]));
  const saved = new Map(X.plans.map((p) => [`${p.who}|${p.date}`, p.items]));
  const drafts = new Map(X.drafts.map((p) => [`${p.who}|${p.date}`, p]));
  const byWho = new Map<string, Array<readonly [string, PmPlanItem[]]>>();
  for (const p of X.plans) { const a = byWho.get(p.who) ?? []; a.push([p.date, p.items]); byWho.set(p.who, a); }
  const live = (t: PmTask) => X.liveMap.get(t.id) ?? liveOf(t);
  return {
    X,
    today: X.today,
    task: (id) => (id ? taskMap.get(id) : undefined),
    live,
    done: (t) => isDone(live(t)),
    late: (t) => isLate(t, live(t), X.today),
    sub: (it) => { const s = it.subId ? subMap.get(it.subId) : undefined; return s && s.taskId === it.taskId ? s : undefined; },
    saved: (who, d) => saved.get(`${who}|${d}`),
    draft: (who, d) => drafts.get(`${who}|${d}`),
    savedDays: (who) => byWho.get(who) ?? [],
  };
}

// ── 한 줄 계산 (pDone · planItP · planApTxt · planH · planSame) ──

export const pDone = (C: PlanCtx, it: PmPlanItem) => (it.subId ? !!C.sub(it)?.done : !!it.done);
export const planItP = (C: PlanCtx, it: PmPlanItem) => (it.pct != null ? +it.pct : pDone(C, it) ? 100 : 0);
export function planApText(C: PlanCtx, it: PmPlanItem): string {
  const t = C.task(it.taskId);
  return t ? `${C.live(t).pct}%` : it.pct != null ? `${it.pct}%` : pDone(C, it) ? '100%' : '';
}
export const planH = (C: PlanCtx, it: PmPlanItem) => +(it.hours ?? (it.subId ? C.sub(it)?.estHours ?? 0 : 0)) || 0;
export function planSame(a: PmPlanItem, b: PmPlanItem): boolean {
  if (a.subId || b.subId) return a.subId === b.subId;
  return (!!a.taskId && a.taskId === b.taskId) || (!!a.text && a.text === b.text);
}
/** 화면 · 복사용 글자 (planTxt): "신광 업무명 – 세부 작업" / 직접 쓴 일 */
export function planText(C: PlanCtx, it: PmPlanItem, shortOf: (projectId: string) => string): string {
  if (it.text) return it.text;
  const t = C.task(it.taskId);
  if (!t) return '(삭제된 업무)';
  if (it.subId) { const s = C.sub(it); return `${shortOf(t.projectId)} ${t.name} – ${s ? s.text : '(삭제된 세부 작업)'}`; }
  return `${shortOf(t.projectId)} ${t.name}`;
}

// ── 내 업무 · 세부 작업 모음 ──

const isLaterOf = (X: PlanInputs, who: string, id: string) => !!X.later.find((x) => x.id === who)?.taskIds.includes(id);

/** 계획에 넣을 수 있는 내 업무 — 급한 순 (planPool 5098) */
export function planPool(C: PlanCtx, who: string): PmTask[] {
  const { X, today } = C;
  const wi = workItemOf(X);
  const blk = new Set(X.tasks.flatMap((t) => t.predecessorIds));
  const soon = addDays(today, 13);
  const rank = (t: PmTask) =>
    (isLaterOf(X, who, t.id) || t.subAssigneeIds.includes(who) ? 50 : 0)
    + (C.late(t) ? 0 : t.milestone || blk.has(t.id) ? 10 : t.end <= soon ? 20 : taskNow(t, C.live(t), today) ? 30 : 40);
  return X.tasks
    .filter((t) => wi(t) && !C.done(t) && t.start && t.end && taskPeople(t).includes(who))
    .map((t) => ({ t, r: rank(t) }))
    .sort((a, b) => a.r - b.r || (a.t.end < b.t.end ? -1 : a.t.end > b.t.end ? 1 : 0))
    .map((x) => x.t);
}

export interface MySub { taskId: string; s: PmSubtask; i: number }
/** 내 미완료 세부 작업 — 예정일 가까운 순, 없으면 적은 순서 (mySubs) */
export function mySubs(C: PlanCtx, who: string): MySub[] {
  const by = new Map<string, PmSubtask[]>();
  for (const s of [...C.X.subtasks].sort((a, b) => a.order - b.order)) {
    if (s.legacyKey || !C.task(s.taskId)) continue;
    const a = by.get(s.taskId) ?? []; a.push(s); by.set(s.taskId, a);
  }
  const out: MySub[] = [];
  for (const [taskId, a] of by) a.forEach((s, i) => { if (!s.done && s.assigneeId === who) out.push({ taskId, s, i }); });
  const due = (s: PmSubtask) => s.due || '9';
  return out.sort((a, b) => (due(a.s) < due(b.s) ? -1 : due(a.s) > due(b.s) ? 1 : a.i - b.i));
}
/** 이 업무에서 내 다음 세부 작업 (적은 순서) */
export function subNext(C: PlanCtx, who: string, taskId: string): PmSubtask | undefined {
  return C.X.subtasks.filter((s) => s.taskId === taskId && !s.legacyKey).sort((a, b) => a.order - b.order).find((s) => !s.done && s.assigneeId === who);
}
export function subCount(C: PlanCtx, taskId: string): string {
  const a = C.X.subtasks.filter((s) => s.taskId === taskId && !s.legacyKey);
  return a.length ? `${a.filter((s) => s.done).length}/${a.length}` : '';
}

// ── 반복 업무 · 넘어온 일 ──

export const planReps = (C: PlanCtx, who: string) => C.X.reps.find((r) => r.id === who)?.items ?? [];
export const planRepsOn = (C: PlanCtx, who: string, d: string): PmPlanItem[] =>
  planReps(C, who).filter((r) => r.wd.includes(dow(d))).map((r) => ({ text: r.text, rep: true }));

/**
 * 다음 날로 넘어가는 일 (planCarryOf 5174) — 직전 근무일에 **직접 쓴** 계획 기준.
 * 체크는 '오늘 몫 끝'일 뿐: 직접 쓴 일 = 100% 안 됨 · 세부 작업 = 안 끝남 · 업무 = 업무가 안 끝남 · 액션 = 안 끝남. 반복 업무 제외.
 */
export function planCarryOf(C: PlanCtx, who: string, d: string): PmPlanItem[] {
  const p = prevWorkday(d);
  return (C.saved(who, p) ?? [])
    .filter((it) => {
      if (it.rep) return false;
      const t = C.task(it.taskId);
      if (it.subId) return !!t && !!C.sub(it) && !pDone(C, it);
      if (it.taskId) return !!t && !C.done(t);
      if (it.actionId) { const a = C.X.actions.find((x) => x.id === it.actionId); return !!a && !a.done && !pDone(C, it); }
      return planItP(C, it) < 100;
    })
    .map(({ done: _d, memo: _m, hours: _h, auto: _a, ...r }) => ({ ...r, from: r.from || p, auto: true }));
}

/** 2주치 계획 (planAll 5108) — 날짜 → 항목. 고친 날은 그대로, 안 고친 날은 자동 초안 */
export function planAll(C: PlanCtx, who: string): Record<string, PmPlanItem[]> {
  const { today } = C;
  const pool = planPool(C, who).filter((t) => !C.late(t));
  const subs = mySubs(C, who);
  const cnt: Record<string, number> = {};
  const out: Record<string, PmPlanItem[]> = {};
  const cf = C.X.carryFrom || nextWorkday(today);
  let spill: PmPlanItem[] = [];
  for (const d of planWeeks(today).flat()) {
    let its = C.saved(who, d);
    if (!its) {
      const due: PmPlanItem[] = subs.filter((x) => x.s.due === d).map(({ taskId, s }) => ({ taskId, subId: s.id, ...(s.estHours ? { hours: s.estHours } : {}), auto: true }));
      const carry = d === today && d >= cf ? planCarryOf(C, who, d).filter((c) => !due.some((x) => planSame(x, c))) : [];
      const taken = new Set([...due, ...carry].map((x) => x.taskId).filter(Boolean) as string[]);
      const head = d >= today ? spill.filter((x) => { const t = C.task(x.taskId); return !!t && !taken.has(t.id) && t.start <= d && t.end >= d && !C.done(t); }) : [];
      head.forEach((x) => taken.add(x.taskId!));
      const full = Math.max(0, PLAN_N - due.length);
      const cap = Math.max(0, full - carry.filter((c) => c.taskId).length);
      const base = pool
        .filter((t) => t.start <= d && t.end >= d && !taken.has(t.id))
        .map((t, i) => ({ t, i }))
        .sort((a, b) => (cnt[a.t.id] ?? 0) - (cnt[b.t.id] ?? 0) || a.i - b.i)
        .slice(0, full)
        .map(({ t }): PmPlanItem => { const s = subNext(C, who, t.id); return s ? { taskId: t.id, subId: s.id, ...(s.estHours ? { hours: s.estHours } : {}), auto: true } : { taskId: t.id, auto: true }; });
      const line = [...head, ...base];
      const wbs = line.slice(0, cap);
      if (d >= today) spill = line.slice(cap);
      its = [...planRepsOn(C, who, d), ...carry, ...due, ...wbs];
    }
    if (d >= today) for (const it of its) if (it.taskId) cnt[it.taskId] = (cnt[it.taskId] ?? 0) + 1;
    out[d] = its;
  }
  return out;
}
export const planDay = (C: PlanCtx, who: string, d: string, all?: Record<string, PmPlanItem[]>) =>
  (all ?? planAll(C, who))[d] ?? C.saved(who, d) ?? [];
/** 고치기 전 그날 목록 — 자동 표시를 뗀 복사본 (planMut 의 앞 절반). 고친 뒤 setPlanDay 로 저장 */
export const planEditable = (C: PlanCtx, who: string, d: string, all?: Record<string, PmPlanItem[]>): PmPlanItem[] =>
  planDay(C, who, d, all).map(({ auto: _a, ...x }) => ({ ...x }));

/** 추천의 [어제 남은 일] — 오늘 계획을 이미 고친 날에만 (planLeft) */
export function planLeft(C: PlanCtx, who: string, all?: Record<string, PmPlanItem[]>): PmPlanItem[] {
  const today = planDay(C, who, C.today, all);
  return planCarryOf(C, who, C.today).map(({ auto: _a, ...r }) => r).filter((it) => !today.some((x) => planSame(x, it)));
}
/** 넘어온 일 표시 '어제부터' / 'N일째' (근무일 기준, carryBadge) — 넘어온 일이 아니면 '' */
export function carryText(it: PmPlanItem, today: string): string {
  if (!it.from || it.from >= today) return '';
  let n = 1;
  for (let x = it.from; x < today; x = addDays(x, 1)) if (!isWeekend(x)) n++;
  return n <= 2 ? '어제부터' : `${n}일째`;
}
/** 최근 직접 입력한 할 일 8개 (planRecent) — 오늘 이미 있는 건 뺌 */
export function planRecentTexts(C: PlanCtx, who: string, all?: Record<string, PmPlanItem[]>): string[] {
  const today = planDay(C, who, C.today, all);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const [, its] of [...C.savedDays(who)].sort((a, b) => (a[0] < b[0] ? 1 : -1))) for (const it of its) if (it.text && !seen.has(it.text)) { seen.add(it.text); out.push(it.text); }
  return out.filter((x) => !today.some((y) => y.text === x)).slice(0, 8);
}

// ── 추천 (planSuggest 5210) ──

export function dueWord(d: string, today: string): string {
  if (!d) return '';
  if (d < today) return '마감 지남';
  if (d === today) return '오늘 마감';
  if (d === addDays(today, 1)) return '내일 마감';
  return diffDays(today, d) <= 6 ? `${WD[dow(d)]}요일 마감` : `${monthDay(d)} 마감`;
}

/** 추천 칩 — 누르면 item 이 오늘 할 일에 들어감 */
export interface PlanSug {
  key: string;
  projectId: string;
  txt: string;
  why: string;
  tip: string;
  item: PmPlanItem;
}
export interface PlanSuggest {
  left: PmPlanItem[];
  must: PlanSug[];
  wait: PlanSug[];
  week: PlanSug[];
  late: PmTask[];
}

/**
 * 추천은 '어디서 왔는지'가 아니라 '얼마나 급한지'로 묶는다. 한 항목은 가장 급한 묶음 하나에만.
 * must 오늘 꼭 = 다음 근무일까지 마감 · wait 나를 기다리는 일 = 검토 차례 · 새 티켓 · 반려 · 남이 배정 · week 이번 주 안에 = 7일 안 마감 + 날짜 없는 내 일.
 */
export function planSuggest(C: PlanCtx, me: string, nameOf: (id: string) => string, all?: Record<string, PmPlanItem[]>): PlanSuggest {
  const { X, today } = C;
  const todayIts = planDay(C, me, today, all);
  const inToday = (it: PmPlanItem) => todayIts.some((x) => planSame(x, it));
  const nw = nextWorkday(today);
  const wk = addDays(today, 7);
  const seen = new Set<string>();
  const G: Pick<PlanSuggest, 'must' | 'wait' | 'week'> = { must: [], wait: [], week: [] };
  const put = (g: keyof typeof G, ids: string[], o: PlanSug) => { if (ids.some((i) => seen.has(i))) return; ids.forEach((i) => seen.add(i)); G[g].push(o); };
  const short = (id: string) => nameOf(id);
  const lastSt = (x: PmTicket) => [...x.hist].reverse().find((h) => !h.comment && !h.field);
  const byDue = <T extends { due: string }>(a: T, b: T) => ((a.due || '9') < (b.due || '9') ? -1 : 1);
  const soon = (d: string) => !!d && d <= nw;
  // 내가 검토 · 승인할 차례인 티켓
  X.tickets.filter((x) => x.status === '검토요청' && tkRevWho(x) === me && x.assigneeId !== me && !todayIts.some((it) => it.ticketNo === x.no)).sort(byDue).forEach((x) =>
    put('wait', [`rv:${x.no}`], { key: `rv:${x.no}`, projectId: x.projectId, txt: x.title, why: `${short(x.assigneeId)} 검토요청`, tip: `${x.no} ${x.title} — 내가 ${tkReviewPending(x) ? '검토' : '승인'}할 차례`, item: { text: `검토 · ${x.title}`, ticketNo: x.no } }));
  // 나에게 온 티켓
  X.tickets.filter((x) => tkOpen(x) && !x.legacyKey && x.assigneeId === me && !todayIts.some((it) => it.ticketNo === x.no || (x.subtaskId ? it.subId === x.subtaskId : !!x.taskId && !it.subId && it.taskId === x.taskId))).sort(byDue).forEach((x) => {
    const h = lastSt(x);
    const ids = [`tk:${x.no}`, ...(x.subtaskId ? [`sub:${x.subtaskId}`] : x.taskId ? [`key:${x.taskId}`] : [])];
    const t = C.task(x.taskId);
    const item: PmPlanItem = t ? { taskId: t.id, ...(x.subtaskId ? { subId: x.subtaskId } : {}), ticketNo: x.no } : { text: x.title, ticketNo: x.no };
    const o = { key: `tk:${x.no}`, projectId: x.projectId, txt: x.title, tip: `${x.no} ${x.title} (${x.status}${x.issuerId ? ` · ${short(x.issuerId)} 발행` : ''}${x.due ? ` · ~${monthDay(x.due)}` : ''})`, item };
    if (soon(x.due)) put('must', ids, { ...o, why: dueWord(x.due, today) });
    else if (x.status === '진행중' && h && h.by && h.by !== me && /^반려/.test(h.text)) put('wait', ids, { ...o, why: '반려됨' });
    else if (x.status === '발행' && x.issuerId && x.issuerId !== me) put('wait', ids, { ...o, why: `${short(x.issuerId)} 발행` });
    else if (!x.due || x.due <= wk) put('week', ids, { ...o, why: x.due ? dueWord(x.due, today) : '내 티켓' });
  });
  // 회의 액션 아이템
  X.actions.filter((a) => !a.done && a.whoId === me && !todayIts.some((it) => it.actionId === a.id)).sort(byDue).forEach((a) => {
    const o = { key: `act:${a.id}`, projectId: a.projectId, txt: a.text, tip: a.text + (a.due ? ` · ~${monthDay(a.due)}` : ''), item: { text: a.text, actionId: a.id } };
    if (soon(a.due)) put('must', [`act:${a.id}`], { ...o, why: dueWord(a.due, today) });
    else put('week', [`act:${a.id}`], { ...o, why: a.due ? dueWord(a.due, today) : '회의 액션' });
  });
  // 내 세부 작업
  const subs = mySubs(C, me);
  subs.filter(({ taskId, s }) => !inToday({ taskId, subId: s.id })).sort((a, b) => byDue(a.s, b.s)).forEach(({ taskId, s }) => {
    const t = C.task(taskId)!;
    const o = { key: `sub:${s.id}`, projectId: t.projectId, txt: s.text, tip: `${t.name} – ${s.text}${s.due ? ` (~${monthDay(s.due)})` : ''}${s.createdBy && s.createdBy !== me ? ` · ${short(s.createdBy)} 배정` : ''}`, item: { taskId, subId: s.id, ...(s.estHours ? { hours: s.estHours } : {}) } };
    if (soon(s.due)) put('must', [`sub:${s.id}`], { ...o, why: dueWord(s.due, today) });
    else if (s.createdBy && s.createdBy !== me) put('wait', [`sub:${s.id}`], { ...o, why: `${short(s.createdBy)} 배정` });
    else put('week', [`sub:${s.id}`], { ...o, why: s.due ? dueWord(s.due, today) : '세부 작업' });
  });
  // 업무 — 마감이 가까운 것만 (쪼갠 업무는 세부 작업으로 나옴)
  const subKeys = new Set(subs.map((x) => x.taskId));
  const pool = planPool(C, me).filter((t) => !subKeys.has(t.id) && !inToday({ taskId: t.id }));
  pool.filter((t) => !C.late(t) && t.end && t.end <= wk).sort((a, b) => (a.end < b.end ? -1 : 1)).forEach((t) =>
    put(t.end <= nw ? 'must' : 'week', [`key:${t.id}`], { key: `key:${t.id}`, projectId: t.projectId, txt: t.name, why: dueWord(t.end, today), tip: `${t.code} ${t.name} (${monthDay(t.start)}~${monthDay(t.end)})`, item: { taskId: t.id } }));
  return { left: planLeft(C, me, all), ...G, late: pool.filter((t) => C.late(t)).sort((a, b) => (a.end > b.end ? -1 : 1)) };
}

/** 빠른 입력의 업무 고르기 목록 — 지금 기간 중 · 세부 작업이 있음 · 7일 안에 시작 (planPickTasks) */
export function planPickTasks(C: PlanCtx, me: string, quickK = ''): PmTask[] {
  const subs = mySubs(C, me);
  const subKeys = new Set(subs.map((x) => x.taskId));
  const wk = addDays(C.today, 7);
  const ts = planPool(C, me).filter((t) => taskNow(t, C.live(t), C.today) || subKeys.has(t.id) || (t.start > C.today && t.start <= wk));
  for (const { taskId } of subs) { const t = C.task(taskId); if (t && !ts.includes(t)) ts.push(t); }
  if (quickK && !ts.some((t) => t.id === quickK)) { const t = C.task(quickK); if (t) ts.unshift(t); }
  return ts;
}

/** 날짜별 추가 창의 후보 (planAddForm 5437) */
export function planAddGroups(C: PlanCtx, me: string, d: string, cur: readonly PmPlanItem[]) {
  const have = new Set(cur.map((x) => x.taskId).filter(Boolean));
  const pool = planPool(C, me).filter((t) => !have.has(t.id) && t.start <= addDays(d, 14));
  const subs = mySubs(C, me).filter(({ s }) => !cur.some((x) => x.subId === s.id));
  return {
    subs,
    groups: ([
      ['이 날 진행 중인 업무', pool.filter((t) => t.start <= d && t.end >= d)],
      ['지연된 업무', pool.filter((t) => t.end < d)],
      ['곧 시작하는 업무 (2주 내)', pool.filter((t) => t.start > d)],
    ] as const).filter((g) => g[1].length),
  };
}

// ── 업무보고 · 복사 · 일일 업무 보고 ──

/** 📋 업무보고 복사 글 (planReport) — 완료한 일 먼저 */
export function planReportText(C: PlanCtx, its: readonly PmPlanItem[], shortOf: (projectId: string) => string): string {
  return [...its].sort((a, b) => (pDone(C, b) ? 1 : 0) - (pDone(C, a) ? 1 : 0)).map((it, i) => {
    const t = C.task(it.taskId);
    const s = it.subId ? C.sub(it) : undefined;
    const title = t ? `${shortOf(t.projectId)} ${t.stage}`.trim() : it.text ?? '';
    const work = t ? t.name + (it.subId ? ` – ${s ? s.text : '(삭제된 세부 작업)'}` : '') : it.text ?? '';
    return `${i + 1}. ${title}\n - 업무내용: ${work}\n - 비고: ${it.memo ?? ''}\n - 진행률: ${planApText(C, it) || '진행 중'}`;
  }).join('\n\n');
}
/** 📋 2주 계획 복사 글 (planCopy) */
export function planCopyText(C: PlanCtx, who: string, shortOf: (projectId: string) => string, all = planAll(C, who)): string {
  return planWeeks(C.today).map((days, w) => `[${w ? '다음 주' : '이번 주'}] ${monthDay(days[0])} ~ ${monthDay(days[4])}\n`
    + days.map((d) => `${monthDay(d)}(${WD[dow(d)]})\n${planDay(C, who, d, all).map((it) => ` - ${planText(C, it, shortOf)}`).join('\n') || ' - 없음'}`).join('\n')).join('\n\n');
}

/** 업무 기록 한 줄 (workRec) — 그날 임시저장본이 있으면 그것, 없으면 직접 고친 계획 */
export interface WorkRec { c: string; n: string; p: string; done: boolean; h: number; taskId: string }
export function workRec(C: PlanCtx, who: string, d: string, shortOf: (projectId: string) => string): WorkRec[] {
  const plan = C.saved(who, d) ?? [];
  const dr = C.draft(who, d);
  if (dr) return dr.rows.map(([c, n, p]) => { const it = plan.find((x) => planText(C, x, shortOf) === c); return { c, n, p, done: it ? pDone(C, it) : p === '100%', h: it ? +(it.hours ?? 0) : 0, taskId: it?.taskId ?? '' }; });
  return plan.map((it) => ({ c: planText(C, it, shortOf), n: it.memo ?? '', p: planApText(C, it), done: pDone(C, it), h: +(it.hours ?? 0), taskId: it.taskId ?? '' }));
}
/** 오늘 업무 기록 (내 업무 '오늘 기록') — 직접 기록이 없고 오늘 계획이 있으면 자동 초안으로 */
export function todayRecord(C: PlanCtx, who: string, shortOf: (projectId: string) => string): { rows: WorkRec[]; auto: boolean } {
  const rec = workRec(C, who, C.today, shortOf);
  const its = planDay(C, who, C.today);
  if (rec.length || !its.length) return { rows: rec, auto: false };
  return { rows: its.map((it) => ({ c: planText(C, it, shortOf), n: it.memo ?? '', p: planApText(C, it), done: pDone(C, it), h: +(it.hours ?? 0), taskId: it.taskId ?? '' })), auto: true };
}
/** 보고 행 (reportRows) — 임시저장본, 없으면 그날 계획 (완료 먼저) */
export function reportRows(C: PlanCtx, who: string, d: string, shortOf: (projectId: string) => string): Array<[string, string, string]> {
  const dr = C.draft(who, d);
  if (dr) return dr.rows.map((r) => [...r]);
  return [...planDay(C, who, d)].sort((a, b) => (pDone(C, b) ? 1 : 0) - (pDone(C, a) ? 1 : 0)).map((it) => [planText(C, it, shortOf), it.memo ?? '', planApText(C, it)]);
}
/** PDF 파일 이름: 팀명(띄어쓰기 없이)+이름_YYMMDD (회사 규칙) */
export const pdfFileName = (dept: string, name: string, date: string) => `${dept.replace(/\s+/g, '')}${name.replace(/\s+/g, '')}_${date.slice(2).replace(/-/g, '')}`;
/** 진행상태 글자 → 10 단위 % ('완료' = 100, 모르면 null) */
export function pdfPVal(p: string): number | null {
  const s = String(p || '').trim();
  const m = s.match(/(\d{1,3})/);
  if (m) return Math.min(100, Math.round(+m[1] / 10) * 10);
  return /완료/.test(s) ? 100 : null;
}
/** 보고 표에서 읽은 줄 정리 — 빈 줄 빼고, 숫자만 쓴 진행상태는 % 붙임 */
export const pdfRowsClean = (rows: ReadonlyArray<readonly [string, string, string]>): Array<[string, string, string]> =>
  rows.map((r) => r.map((x) => x.trim()) as [string, string, string]).filter((r) => r.some(Boolean)).map(([c, n, p]) => [c, n, p && /^\d+$/.test(p) ? `${p}%` : p]);

/**
 * 보고 표 → 그날 할 일 (pdfToPlan): 없는 업무는 진행률과 함께 추가, 이미 있는 직접 쓴 일은 진행률만 맞춤.
 * 업무(업무 목록) 진행률은 실적이라 바꾸지 않음. 바뀐 게 없으면 null
 */
export function pdfToPlanApply(C: PlanCtx, cur: readonly PmPlanItem[], rows: ReadonlyArray<readonly [string, string, string]>, shortOf: (projectId: string) => string): { items: PmPlanItem[]; add: number; upd: number } | null {
  const seen = new Set<string>();
  const list = rows.filter((r) => r[0] && !seen.has(r[0]) && seen.add(r[0]));
  const items = cur.map((x) => ({ ...x }));
  let add = 0;
  let upd = 0;
  for (const [c, , p] of list) {
    const v = pdfPVal(p);
    const it = items.find((x) => planText(C, x, shortOf) === c);
    if (!it) { items.push({ text: c, ...(v != null ? { pct: v } : {}), ...(v === 100 ? { done: true } : {}) }); add++; }
    else if (!it.taskId && v != null && v !== planItP(C, it)) { it.pct = v; if (v === 100) it.done = true; upd++; }
  }
  return add || upd ? { items, add, upd } : null;
}

// ── 다른 화면이 쓰는 것 ──

/** 투입 시간 기록 (hoursRows) — 업무계획 '시간' 칸에 적은 것만 (자동 초안은 시간이 없어 빠짐) */
export function planHourRows(C: PlanCtx, shortOf: (projectId: string) => string): HourRow[] {
  const R: HourRow[] = [];
  for (const p of C.X.plans) for (const it of p.items) {
    const h = planH(C, it);
    if (!h) continue;
    const t = C.task(it.taskId);
    R.push({ who: p.who, d: p.date, h, projectId: t ? t.projectId : '', txt: planText(C, it, shortOf) });
  }
  return R;
}
/**
 * 과제 수행일지 줄 (allLogs 5384) — 업무계획 '시간' 칸에 적은 것. 수행 내용 = 그날 일일 보고 임시저장본의 비고 →
 * 계획 메모 → (업무가 아니면) 할 일 글자. 데모의 예전 작업일지(S.logs)는 새로 쓰지 않는 기록이고 옮길 것이 없어 뺌.
 */
export interface LogRow { who: string; date: string; projectId: string; taskId: string; ticketNo: string; title: string; content: string; hours: number }
export function planLogRows(C: PlanCtx, shortOf: (projectId: string) => string): LogRow[] {
  const out: LogRow[] = [];
  for (const p of C.X.plans) {
    const dr = C.draft(p.who, p.date);
    for (const it of p.items) {
      const h = +(it.hours ?? 0) || 0;
      if (!h) continue;
      const t = C.task(it.taskId);
      const txt = planText(C, it, shortOf);
      const row = dr?.rows.find((r) => r[0] === txt);
      out.push({ who: p.who, date: p.date, projectId: t ? t.projectId : '', taskId: it.taskId ?? '', ticketNo: it.ticketNo ?? '', title: t ? '' : txt, content: (row ? row[1] : it.memo) || (t ? '' : txt), hours: h });
    }
  }
  return out;
}
/** 마지막 업데이트에 더할 날 — 직접 고친 날 (오늘까지) */
export const planDaysOf = (C: PlanCtx, who: string) => C.savedDays(who).map(([d]) => d).filter((d) => d <= C.today);
/** 진행률 갱신으로 치는 날 — 업무 줄을 체크 · 메모한 날 (updIdx) */
export function planUpdDates(C: PlanCtx): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const p of C.X.plans) for (const it of p.items) if (it.taskId && !it.auto && (it.memo || pDone(C, it))) { const a = m.get(it.taskId) ?? []; a.push(p.date); m.set(it.taskId, a); }
  return m;
}
/** 최근 7일 업무계획에 넣은 업무 → 넣은 사람 · 날 (planRecentIdx) */
export function planRecentIdx(C: PlanCtx): Map<string, { who: string; d: string }> {
  const m = new Map<string, { who: string; d: string }>();
  const from = addDays(C.today, -7);
  for (const p of C.X.plans) {
    if (p.date < from || p.date > C.today) continue;
    for (const it of p.items) if (it.taskId && !it.auto && !it.subId) { const o = m.get(it.taskId); if (!o || p.date > o.d) m.set(it.taskId, { who: p.who, d: p.date }); }
  }
  return m;
}
/** 업무를 [완료] · [완료 취소]하면 오늘 할 일의 그 업무 줄 체크도 맞춤 (planMarkTask). 그 줄이 없으면 null */
export function planMarkTask(cur: readonly PmPlanItem[], taskId: string, done: boolean): PmPlanItem[] | null {
  if (!cur.some((it) => it.taskId === taskId && !it.subId)) return null;
  return cur.map((it) => (it.taskId === taskId && !it.subId ? { ...it, done } : it));
}

/** 팀 일일 보고 모아 받기 — 사람별 상태 (teamPdfForm): 직접 고친 날 / 임시저장 = 작성함 */
export function teamPlanStatus(C: PlanCtx, who: string, d: string) {
  const own = !!C.saved(who, d) || !!C.draft(who, d);
  const its = planDay(C, who, d);
  return { own, n: its.length, done: its.filter((x) => pDone(C, x)).length, memo: its.filter((x) => x.memo).length };
}
