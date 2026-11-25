import { addDays, diffDays, isDone, isLate, liveOf, monthDay, taskPeople, type Live } from './rules';
import type { PmAction, PmChangeRequest, PmIssue, PmMeeting, PmMilestoneOk, PmProject, PmSubtask, PmTask, PmUpdRequest } from './schema';
import {
  agrWarn, asIssues, dday, dlStat, dutyRec, isDrop, isPre, planDuties, siteStats, warrantyEnd, weekStart, govItems,
  type SiteCtx,
} from './site';
import type { PmTicket } from './ticket';
import { msReqOf, myUpdList, taskUpd, tkRevWho, updIndex, updInfoOf, type UpdInputs } from './my';
import { workItemOf } from './team';

/**
 * 🔔 내 알림 (데모 myAlerts 2744 · bellGroup 2813) — PM 화면 안 목록만 (메신저 · 푸시는 2차, 11/25 결정).
 * 확인한 알림은 문구로 기억한다 (S.seen) → 건수 등 문구가 바뀌면 새 알림으로 다시 뜬다.
 * 요구사항(CR) 알림은 4단계(4-3), 회의록 알림은 5단계(5-2)에서 더함.
 */

/** 누르면 갈 곳 */
export type AlertGo =
  | { kind: 'view'; v: string; params?: Record<string, string> }
  | { kind: 'task'; id: string }
  | { kind: 'ticket'; no: string };

export interface PmAlert {
  lv: 'bad' | 'warn' | 'ok';
  txt: string;
  go?: AlertGo;
  /** 같은 종류가 2개 사업 이상이면 한 줄로 (bellGroup) */
  grp?: 'duty' | 'buyer' | 'wc' | 'ms';
  gk?: string;
  gn?: number;
  /** 진행률 갱신 (내 몫) — '내 사업 남은 갱신' 줄과 합침 */
  upd?: boolean;
}

export interface AlertInputs extends UpdInputs {
  tickets: readonly PmTicket[];
  subtasks: readonly PmSubtask[];
  actions: readonly PmAction[];
  issues: readonly PmIssue[];
  msOk: ReadonlyMap<string, PmMilestoneOk>;
  updReq: readonly PmUpdRequest[];
  /** 요구사항 변경 (4단계) */
  crs?: readonly PmChangeRequest[];
  /** 회의록 (5단계) */
  meetings?: readonly PmMeeting[];
  /** 사업마다 계산 묶음 (탈락 포함 — 여기서 뺌) */
  sites: readonly SiteCtx[];
  /** 사업 PM (사용자 ID 들) — 사업 정보 PM · 업무 목록 PM */
  pmOf: (p: PmProject) => string[];
  /** 사업 짧은 이름 */
  shortOf: (projectId: string) => string;
  /** 사람 이름 (성 빼지 않은 이름만) */
  nameOf: (id: string) => string;
}

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
const dow = (d: string) => new Date(`${d}T00:00:00`).getDay();
/** 마지막 상태 변경 줄 (코멘트 · 칸 변경 빼고) */
const lastSt = (x: PmTicket) => [...x.hist].reverse().find((h) => !h.comment && !h.field);

export function myAlerts(me: string, X: AlertInputs): PmAlert[] {
  const T = X.today;
  const out: PmAlert[] = [];
  const short = (id: string) => X.nameOf(id) || '알 수 없음';
  const L = (t: PmTask): Live => X.liveMap.get(t.id) ?? liveOf(t);
  const wi = workItemOf(X);
  const view = (v: string, params?: Record<string, string>): AlertGo => ({ kind: 'view', v, ...(params ? { params } : {}) });
  const site = (c: SiteCtx, params: Record<string, string> = {}) => view('dash/site', { k: c.p.id, ...params });
  const live = X.sites.filter((c) => !isDrop(c.p));
  const isPm = (c: SiteCtx) => X.pmOf(c.p).includes(me);
  const recent = (d: string) => !!d && diffDays(d, T) <= 7;

  // 지연 업무 (내가 담당)
  const late = X.tasks.filter((t) => wi(t) && isLate(t, L(t), T) && taskPeople(t).includes(me));
  if (late.length) out.push({ lv: 'bad', txt: `내가 담당한 지연 TASK ${late.length}건 — 내 업무 › [전체 업무] '지금 할 일' (지연 우선)`, go: view('dash/my', { board: 'all' }) });

  // 남이 나에게 배정한 세부 작업 (안 끝난 것)
  const taskOf = new Map(X.tasks.map((t) => [t.id, t]));
  // 예정일 가까운 순, 없으면 뒤 (데모 mySubs)
  const subOrd = [...X.subtasks].sort((a, b) => ((a.due || '9') < (b.due || '9') ? -1 : (a.due || '9') > (b.due || '9') ? 1 : 0));
  for (const s of subOrd) {
    if (s.legacyKey || s.done || s.assigneeId !== me || !s.createdBy || s.createdBy === me) continue;
    const t = taskOf.get(s.taskId);
    if (!t) continue;
    out.push({ lv: s.due && s.due < T ? 'bad' : 'warn', txt: `새로 배정된 일 · ${X.shortOf(t.projectId)} ${trunc(s.text, 28)} (${short(s.createdBy)} 배정${s.due ? ` · ${monthDay(s.due)}${s.due === T ? ' 오늘' : ''}` : ' · 예정일 없음'})`, go: view('dash/plan') });
  }

  // 담당자에게: 남이 발행한 새 티켓(접수 전) · 반려 · 완료 승인 (7일)
  for (const x of X.tickets) {
    if (x.assigneeId !== me || x.status === '취소' || x.legacyKey) continue;
    const h = lastSt(x);
    if (x.status === '발행' && x.issuerId && x.issuerId !== me) out.push({ lv: 'warn', txt: `새 티켓 · ${x.no} ${trunc(x.title, 28)} (${short(x.issuerId)} 발행 · 접수 대기)`, go: { kind: 'ticket', no: x.no } });
    else if (x.status === '진행중' && h && h.by && h.by !== me && /^반려/.test(h.text)) out.push({ lv: 'bad', txt: `반려된 티켓 · ${x.no} ${trunc(x.title, 24)} — ${trunc(h.text.replace(/^반려 — 재작업 요청( — )?/, '') || '사유 확인', 24)}`, go: { kind: 'ticket', no: x.no } });
    else if (x.status === '완료' && h && h.by && h.by !== me && h.date && diffDays(h.date, T) <= 7) out.push({ lv: 'ok', txt: `완료 승인됨 · ${x.no} ${trunc(x.title, 28)} (${short(h.by)})`, go: { kind: 'ticket', no: x.no } });
  }
  // 검토 · 승인할 차례
  for (const x of X.tickets) if (x.status === '검토요청' && tkRevWho(x) === me) out.push({ lv: 'warn', txt: `${x.reviewerId && !x.reviewOk ? '검토' : '승인'} 대기 티켓 · ${x.no} ${trunc(x.title, 30)}`, go: { kind: 'ticket', no: x.no } });

  // 액션 아이템: 남이 등록한 새 것 · 기한 된 것
  const actOpen = (a: PmAction) => !a.done;
  for (const a of X.actions) if (actOpen(a) && a.whoId === me && a.by && a.by !== me && !(a.due && a.due <= T)) out.push({ lv: 'warn', txt: `새 액션 아이템 · ${trunc(a.text, 30)} (${short(a.by)} 등록${a.due ? ` · ${monthDay(a.due)}까지` : ''})`, go: view('doc/meet', { act: a.id }) });
  for (const a of X.actions) if (actOpen(a) && a.whoId === me && a.due && a.due <= T) out.push({ lv: a.due < T ? 'bad' : 'warn', txt: `액션 아이템 · ${trunc(a.text, 34)} (${dday(a.due, T)})`, go: view('doc/meet', { act: a.id }) });

  // 이슈: 내 담당 · 관련 (남이 올린 것) · 내가 올린 이슈 해결됨 (30일)
  for (const i of X.issues) if (i.status !== '해결' && (i.ownerId === me || i.watchIds.includes(me)) && i.by !== me) out.push({ lv: i.sev === '긴급' ? 'bad' : 'warn', txt: `${i.sev === '긴급' ? '긴급 ' : ''}이슈 · ${i.id} ${trunc(i.title, 26)} (${i.ownerId === me ? '내 담당' : '관련자'} · ${i.status})`, go: view('risk/issue', { issue: i.id }) });
  for (const i of X.issues) if (i.status === '해결' && i.by === me && i.ownerId !== me && i.at && diffDays(i.at, T) <= 30) out.push({ lv: 'warn', txt: `내가 올린 이슈 해결됨 · ${i.id} ${trunc(i.title, 26)}`, go: view('risk/issue', { issue: i.id }) });

  // 수주 → 착수: 선정평가 끝 · 영업→PM 인수인계
  for (const c of live.filter((c) => isPm(c) && c.p.start)) {
    const s = c.p;
    const tk = (re: RegExp) => c.ts.filter(isPre).find((t) => re.test(t.name));
    const sel = tk(/선정결과/);
    const hand = tk(/인수인계/);
    if (s.evalDate && s.evalDate < T && T < s.start && !s.bidRes && (sel ? !isDone(c.live(sel)) : diffDays(s.evalDate, T) <= 14))
      out.push({ lv: 'warn', txt: `${X.shortOf(s.id)} · 선정평가(${monthDay(s.evalDate)}) 끝 — 사업 화면 '수주 진행'에서 선정 · 탈락 기록, 선정이면 협약일 확정 (지금 예상 협약일 ${monthDay(s.start)})`, go: site(c) });
    if (hand && !isDone(c.live(hand)) && s.start <= T && T < addDays(s.start, 30))
      out.push({ lv: 'bad', txt: `${X.shortOf(s.id)} · 착수 인수인계(영업→PM)가 안 끝났습니다 — 협약 시작 ${monthDay(s.start)}`, go: { kind: 'task', id: hand.id } });
  }
  // 사후관리: 하자보증 만료 30일 전부터
  for (const c of live.filter((c) => isPm(c) && c.p.end && T > c.p.end)) {
    const we = warrantyEnd(c.p);
    if (!we || we < T || diffDays(T, we) > 30) continue;
    const oa = asIssues(c).filter((x) => x.status !== '해결').length;
    out.push({ lv: diffDays(T, we) <= 7 ? 'bad' : 'warn', txt: `${X.shortOf(c.p.id)} · 하자보증 만료 ${dday(we, T)} (${monthDay(we)})${oa ? ` — 처리 안 된 하자 · AS ${oa}건` : ''} — 사업 화면 '사후관리'`, go: site(c) });
  }
  // 수주 단계: 공고 마감 · 선정평가 7일 전부터
  for (const c of live.filter((c) => isPm(c) && c.p.start && T < c.p.start)) {
    for (const [l, d] of [['공고 마감 (사업계획서 신청)', c.p.annDue], ['선정평가', c.p.evalDate]] as const) {
      if (d && d >= T && diffDays(T, d) <= 7) out.push({ lv: diffDays(T, d) <= 3 ? 'bad' : 'warn', txt: `${X.shortOf(c.p.id)} · ${l} ${dday(d, T)} (${monthDay(d)}) — 사업 화면 '수주 진행'`, go: site(c) });
    }
  }
  // 계획서 약속: 기한 지남 · 2주 안 (dutyLate · dutySoon)
  for (const c of live.filter(isPm)) {
    const du = planDuties(c).filter((d) => !dutyRec(c, d) && !d.after && d.due);
    const nl = du.filter((d) => d.due < T).length;
    const ns = du.filter((d) => d.due >= T && diffDays(T, d.due) <= 14).length;
    if (nl || ns) out.push({ grp: 'duty', gk: X.shortOf(c.p.id), gn: nl + ns, lv: nl ? 'bad' : 'warn', txt: `${X.shortOf(c.p.id)} · 계획서 약속 사항 ${nl ? `기한 경과 ${nl}건` : ''}${nl && ns ? ' · ' : ''}${ns ? `2주 내 기한 ${ns}건` : ''} — 사업 화면 '기한'`, go: site(c) });
  }
  // 보완 지적 사항: 내 몫(조치 전) → 담당자, 조치 완료(확인 대기) → 사업 PM
  for (const c of live) {
    const pm = isPm(c);
    const gi = govItems(c) ?? [];
    for (const [pid, r] of c.gov) {
      if (!r.items.length) continue;
      const fol = gi.find((x) => x.follow === pid);
      for (const it of r.items) if (it.st === '조치 전' && it.whoId === me) out.push({ lv: fol && fol.due && fol.due < T ? 'bad' : 'warn', txt: `보완 조치 · ${X.shortOf(c.p.id)} ${trunc(it.text, 26)}${fol && fol.due ? ` (기한 ${monthDay(fol.due)})` : ''}`, go: site(c, { fix: pid }) });
      const n = r.items.filter((it) => it.st === '조치 완료').length;
      if (pm && n) out.push({ lv: 'warn', txt: `${X.shortOf(c.p.id)} · 보완 조치 확인 대기 ${n}건`, go: site(c, { fix: pid }) });
    }
  }
  // 도입기업 챙길 일 (dlStat)
  for (const c of live.filter(isPm)) {
    const B = dlStat(c).buyer;
    if (B.length) out.push({ grp: 'buyer', gk: X.shortOf(c.p.id), gn: B.length, lv: B.some((g) => g.due < T) ? 'bad' : 'warn', txt: `${X.shortOf(c.p.id)} · 도입기업 챙길 일 ${B.length}건 — ${trunc(B[0].t, 22)} — 사업 화면 '기한'`, go: site(c, { side: 'buyer' }) });
  }
  // 협약변경: 업무 목록이 협약 종료일보다 늦게 끝남 (협약 전은 예상 날짜라 뺌)
  for (const c of live.filter(isPm)) {
    const w = c.p.start && c.p.start <= T ? agrWarn(c) : null;
    if (!w) continue;
    const pend = c.agr.filter((x) => x.kind === 'ext' && !['승인', '등록 완료', '반려'].includes(x.st)).slice(-1)[0];
    out.push({ lv: !pend || w.over6 ? 'bad' : 'warn', txt: `${X.shortOf(c.p.id)} · WBS가 협약 종료일(${monthDay(c.p.end)})보다 ${w.days}일 늦게 끝남 — ${w.over6 ? '6개월 넘어 연장 불가, 일정을 당겨야 함' : w.kind === '승인' ? '협약변경 승인 필요' : '사업관리시스템 등록 필요'}${pend ? ` · 기록됨(${pend.st})` : ' · 아직 기록 없음'} — 사업 화면 '협약변경 기록'`, go: site(c) });
  }
  // 내가 입력할 진행률 갱신: PM 이 요청했거나 목요일부터 (일요일 포함)
  const ws = weekStart(T);
  const thu = dow(T) >= 4 || dow(T) === 0;
  {
    const rq = X.updReq.find((r) => r.id === me);
    const n = myUpdList(me, X).filter((x) => !x.done).length;
    const asked = !!rq && rq.date >= ws;
    if (n && (asked || thu)) out.push({ upd: true, lv: asked ? 'bad' : 'warn', txt: `진행률 갱신 ${n}건${asked ? ` — ${short(rq!.by)}님 요청 (${monthDay(rq!.date)})` : ''} — 내 업무 맨 위 '진행률 갱신'에서 5건씩`, go: view('dash/my') });
  }
  // 주간 점검: 목요일부터 내가 PM인 사업의 이번 주 진행률 갱신이 덜 끝났으면
  if (thu) {
    const idx = updIndex(X);
    const info = updInfoOf(X, idx);
    for (const c of live.filter((c) => c.ts.length && isPm(c))) {
      const ts = c.ts.filter((t) => info(t));
      const ok = ts.filter((t) => taskUpd(idx, t.id) >= ws).length;
      if (ok < ts.length) out.push({ grp: 'wc', gk: X.shortOf(c.p.id), gn: ts.length - ok, lv: 'warn', txt: `${X.shortOf(c.p.id)} · 이번 주 진행률 갱신 ${ok} / ${ts.length}건 — 주간 진행률 '사람별 갱신 현황'`, go: view('doc/check', { k: c.p.id }) });
    }
  }
  // 내가 맡긴 일이 끝났을 때 (7일) — 세부 작업 · 액션 아이템
  for (const s of X.subtasks) {
    const t = taskOf.get(s.taskId);
    if (!t || s.legacyKey || !s.done || s.createdBy !== me || !s.assigneeId || s.assigneeId === me || s.doneBy === me || !recent(s.doneDate)) continue;
    out.push({ lv: 'ok', txt: `맡긴 일 완료 · ${X.shortOf(t.projectId)} ${trunc(s.text, 28)} (${short(s.assigneeId)} · ${monthDay(s.doneDate)})`, go: view('dash/plan') });
  }
  for (const a of X.actions) if (a.done && a.by === me && a.whoId !== me && a.doneBy !== me && recent(a.doneDate)) out.push({ lv: 'ok', txt: `액션 아이템 완료 · ${trunc(a.text, 30)} (${short(a.whoId)} · ${monthDay(a.doneDate)})`, go: view('doc/meet', { act: a.id }) });
  // CR: 사업 PM 에게 검토 대기 · 접수자에게 결과 (7일) — 누르면 그 CR 창 (crReview · crEdit)
  const crPm = (c: PmChangeRequest) => live.some((s) => s.p.id === c.projectId && isPm(s));
  for (const c of X.crs ?? []) if (c.status === '검토중' && c.by !== me && crPm(c)) out.push({ lv: 'warn', txt: `CR 검토 대기 · ${c.id} ${trunc(c.title, 28)}${c.by ? ` (${short(c.by)} 접수)` : ''}`, go: view('site/cr', { cr: c.id, review: '1' }) });
  for (const c of X.crs ?? []) if (c.status !== '검토중' && c.by === me && c.reviewer && c.reviewer !== me && recent(c.revD)) out.push({ lv: c.status === '승인' ? 'ok' : 'bad', txt: `CR ${c.status} · ${c.id} ${trunc(c.title, 26)} (${short(c.reviewer)})`, go: view('site/cr', { cr: c.id }) });
  // 회의록: 참석자로 들어간 새 회의록 (작성자 본인 제외, 작성일부터 7일) — 누르면 그 회의 (mtOpen)
  for (const m of X.meetings ?? []) if (m.attIds.includes(me) && m.by && m.by !== me && recent(m.at || m.date)) out.push({ lv: 'warn', txt: `새 회의록 · ${m.projectId ? `${X.shortOf(m.projectId)} ` : ''}${trunc(m.title, 28)} (${short(m.by)} 작성 · ${monthDay(m.date)})`, go: view('doc/meet', { mt: m.id }) });
  // 마일스톤: 완료됐고 승인만 남은 것 → 사업 PM
  for (const c of live.filter(isPm)) {
    const n = siteStats(c).ms.filter((t) => !isPre(t) && isDone(c.live(t)) && !X.msOk.has(t.id) && msReqOf(X.tasks, t).every((x) => isDone(L(x)))).length;
    if (n) out.push({ grp: 'ms', gk: X.shortOf(c.p.id), gn: n, lv: 'warn', txt: `${X.shortOf(c.p.id)} · 마일스톤 승인 대기 ${n}건 — 내 업무 › 처리할 일 › '승인 대기'`, go: view('dash/my', { inbox: '1' }) });
  }
  return bellGroup(out);
}

/** 여러 사업을 묶은 줄의 이름과 갈 곳 (BELL_GRP · BELL_GRP_GO) */
const BELL_GRP: Record<NonNullable<PmAlert['grp']>, { name: string; go: AlertGo; where: string }> = {
  duty: { name: '계획서 약속 기한 경과 · 임박', go: { kind: 'view', v: 'dash/overview' }, where: '통합 사업 현황 표의 다음 기한' },
  buyer: { name: '도입기업 챙길 일', go: { kind: 'view', v: 'dash/overview' }, where: '통합 사업 현황 표의 도입기업 칸' },
  wc: { name: '이번 주 진행률 갱신 남은 사업', go: { kind: 'view', v: 'doc/check' }, where: '주간 진행률 요약 표' },
  ms: { name: '마일스톤 승인 대기', go: { kind: 'view', v: 'dash/my', params: { inbox: '1' } }, where: "내 업무 › 처리할 일 › '승인 대기'" },
};
/** 같은 종류 알림이 2개 사업 이상이면 한 줄로 · 진행률 갱신은 '내 몫'과 '내 사업 남은 것'을 한 줄로 (bellGroup) */
export function bellGroup(out: readonly PmAlert[]): PmAlert[] {
  const res: PmAlert[] = [];
  const seen = new Set<string>();
  for (const a of out) {
    if (!a.grp) { res.push({ ...a }); continue; }
    const L = out.filter((x) => x.grp === a.grp);
    if (L.length < 2) { res.push({ ...a }); continue; }
    if (seen.has(a.grp)) continue;
    seen.add(a.grp);
    const G = BELL_GRP[a.grp];
    const n = L.reduce((t, x) => t + (x.gn ?? 0), 0);
    res.push({ ...a, go: G.go, gn: n, lv: L.some((x) => x.lv === 'bad') ? 'bad' : 'warn', txt: `${G.name} ${L.length}곳 — ${L.map((x) => `${x.gk} ${x.gn}`).join(' · ')} — ${G.where}` });
  }
  const u = res.find((x) => x.upd);
  const w = res.find((x) => x.grp === 'wc');
  if (u && w) {
    const L = out.filter((x) => x.grp === 'wc');
    u.txt += ` · 내가 PM인 사업 남은 갱신 ${L.map((x) => `${x.gk} ${x.gn}`).join(' · ')}`;
    if (w.lv === 'bad') u.lv = 'bad';
    res.splice(res.indexOf(w), 1);
  }
  return res;
}

/** 확인한 알림인가 (alertSeen) */
export const alertSeen = (seen: Readonly<Record<string, string>> | undefined, a: PmAlert) => !!seen?.[a.txt];
