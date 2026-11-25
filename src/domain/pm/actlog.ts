import type { AlertGo } from './alerts';
import { addDays } from './rules';
import type { PmAction, PmChangeLog, PmChangeRequest, PmDoc, PmMeeting, PmProject, PmSubtask, PmTask, PmWeekCheck } from './schema';
import { AGR_KINDS, govItems, planDuties, siteCtxOf, type SiteInputs } from './site';
import type { PmTicket } from './ticket';

/**
 * 기준정보 › 활동 기록 (데모 activityAll 8128 · pActLog 8156) — 흩어진 기록을 한곳에 모아 봄.
 * 새로 남기는 기록은 없고, 이미 남고 있는 기록만 모음: 업무 목록 변경 이력 · 티켓 처리 · 점검 결과 · 관리기준 / 약속 완료 체크 · 보완 지적 처리 ·
 * 협약변경 · 주간 특이사항 · 진행률 '변동 없음' · 산출물 제출 · 이슈 · CR · 회의록 · 액션 아이템 · 세부 작업 · 수주 결과.
 * (데모의 '계획서' 줄 = 사업계획서 PDF 등록은 PDF 보관이 7단계라 아직 기록이 생기지 않음)
 * 사람 칸 = 그룹웨어 사용자 ID (티켓의 'system' 포함).
 */
export interface ActRow { d: string; who: string; cat: string; k: string; txt: string; go: AlertGo | null }

export interface ActInputs extends SiteInputs {
  projects: readonly PmProject[];
  logs: readonly PmChangeLog[];
  tickets: readonly PmTicket[];
  subtasks: readonly PmSubtask[];
  weekChecks: readonly PmWeekCheck[];
  docs: readonly PmDoc[];
  crs: readonly PmChangeRequest[];
  meetings: readonly PmMeeting[];
  actions: readonly PmAction[];
  today: string;
  nameOf: (id: string) => string;
}

const trunc = (s: string, n: number) => (String(s ?? '').length > n ? `${String(s).slice(0, n)}…` : String(s ?? ''));
const md = (d: string) => (d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : '');
const view = (v: string, params?: Record<string, string>): AlertGo => ({ kind: 'view', v, ...(params ? { params } : {}) });

export function activityAll(X: ActInputs): ActRow[] {
  const out: ActRow[] = [];
  const add = (d: string, who: string, cat: string, k: string, txt: string, go: AlertGo | null) => { if (d) out.push({ d, who: who || '', cat, k: k || '', txt, go }); };
  const taskById = new Map(X.tasks.map((t) => [t.id, t]));
  const taskByCode = new Map(X.tasks.map((t) => [`${t.projectId}|${t.code}`, t]));
  const has = new Set(X.projects.map((p) => p.id));
  const site = (k: string) => (has.has(k) ? view('dash/site', { k }) : null);
  const taskGo = (t: PmTask | undefined): AlertGo | null => (t ? { kind: 'task', id: t.id } : null);
  const first = (id: string) => X.nameOf(id).split(/\s+/)[0] || '';

  for (const x of X.logs) {
    const t = taskByCode.get(`${x.projectId}|${x.code}`);
    add(x.date, x.by, '업무 목록', x.projectId, `${x.code && x.code !== '-' ? `${x.code} ` : ''}${x.kind} — ${x.text}`, taskGo(t));
  }
  for (const t of X.tickets) for (const h of t.hist) add(h.date, h.by, '티켓', t.projectId, `${t.no} ${trunc(t.title, 30)} — ${h.text || '댓글'}`, { kind: 'ticket', no: t.no });

  // 데모 순서: 점검 · 관리기준(모든 사업) → 계획서 약속(모든 사업) → 사업마다 협약변경 · 특이사항 · 수주.
  // 데모의 점검 · 약속은 S.gov · S.planChk 에 처음 기록이 생긴 사업 순, 이관은 사업 목록 순 (같은 날 · 같은 종류 안에서만 차이)
  const ctxs = X.projects.map((p) => ({ p, c: siteCtxOf(p, X, X.today), go: site(p.id) }));
  for (const { p, c, go } of ctxs) {
    const G = govItems(c) ?? [];
    for (const r of c.gov.values()) {
      const g = G.find((x) => x.id === r.itemId);
      const nm = g ? g.t.replace(/ —.*$/, '') : r.itemId;
      add(r.bulk || r.date, r.by, r.v ? '점검 결과' : '관리기준', p.id, r.v ? `${nm} — ${r.v}${r.memo ? ` · ${r.memo}` : ''}` : `${nm} 완료 체크${r.bulk ? ` (지난 기한 정리 · 완료한 날 ${md(r.date)})` : ''}`, go);
      for (const it of r.items) for (const h of it.hist) add(h.date, h.by, '보완 지적', p.id, `${trunc(it.text, 30)} — ${h.a}${h.note ? ` · ${h.note}` : ''}`, go);
    }
  }
  for (const { p, c, go } of ctxs) {
    const L = planDuties(c);
    for (const r of c.planChk.values()) {
      if (!r.date) continue;
      const d0 = L.find((x) => x.id === r.dutyId);
      add(r.bulk || r.date, r.by, '계획서 약속', p.id, `${d0 ? trunc(d0.t, 40) : r.dutyId} 완료 체크${r.bulk ? ` (지난 기한 정리 · 완료한 날 ${md(r.date)})` : ''}`, go);
    }
  }
  for (const { p, c, go } of ctxs) {
    for (const x of c.agr) add(x.date, x.by, '협약변경', p.id, `${AGR_KINDS.find((y) => y[0] === x.kind)?.[1] ?? ''} · ${x.st}${x.text ? ` · ${x.text}` : ''}`, go);
    for (const r of c.reports ?? []) if (r.note || r.req) add(r.at || r.week, r.by, '주간 특이사항', p.id, trunc([r.note, r.req ? `협조 요청: ${r.req}` : ''].filter(Boolean).join(' / '), 60), view('doc/check', { k: p.id }));
    if (p.bidAt && p.bidAt.date) add(p.bidAt.date, p.bidAt.by, '수주', p.id, `선정 결과 '${p.bidRes || '지움'}'`, go);
  }

  for (const w of X.weekChecks) { const t = taskById.get(w.taskId); if (t) add(w.date, w.by, '진행률', t.projectId, `${t.code} ${trunc(t.name, 30)} — 변동 없음 확인`, taskGo(t)); }
  for (const x of X.docs) { const t = taskById.get(x.id); if (x.date && t) add(x.date, x.by, '산출물', t.projectId, `${trunc(t.output || t.name, 30)} — ${x.st}${x.file ? ` · ${x.file}` : ''}`, taskGo(t)); }
  for (const i of X.issues) add(i.at || i.date, i.by, '이슈', i.projectId, `${i.id} ${trunc(i.title, 40)} 등록 (${i.sev || '보통'})`, view('risk/issue', { issue: i.id }));
  for (const c of X.crs) {
    const go = view('site/cr', { cr: c.id });
    add(c.at, c.by, 'CR', c.projectId, `${c.id} ${trunc(c.title, 40)} 접수`, go);
    if (c.revD) add(c.revD, c.reviewer, 'CR', c.projectId, `${c.id} ${c.status}`, go);
  }
  for (const m of X.meetings) add(m.at || m.date, m.by, '회의록', m.projectId, `${trunc(m.title, 40)} 작성`, view('doc/meet', { mt: m.id }));
  for (const a of X.actions) {
    const go = view('doc/meet', { act: a.id });
    add(a.at, a.by, '액션 아이템', a.projectId, `${trunc(a.text, 40)} 등록 → ${first(a.whoId) || '미지정'}`, go);
    if (a.done && a.doneDate) add(a.doneDate, a.doneBy || a.whoId, '액션 아이템', a.projectId, `${trunc(a.text, 40)} 완료`, go);
  }
  for (const s of X.subtasks) {
    const t = taskById.get(s.taskId);
    const k = t?.projectId ?? '';
    add(s.createdDate, s.createdBy || s.assigneeId, '세부 작업', k, `${trunc(s.text, 36)} 추가${s.assigneeId && s.createdBy && s.assigneeId !== s.createdBy ? ` → ${first(s.assigneeId)}` : ''}`, taskGo(t));
    if (s.done && s.doneDate) add(s.doneDate, s.doneBy || s.assigneeId, '세부 작업', k, `${trunc(s.text, 36)} 완료`, taskGo(t));
  }
  // 최근 순 (같은 날은 모은 순서 그대로 — 데모 sort 와 같음, 모으는 순서도 데모 activityAll 순)
  return out.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
}

export interface ActFilter { per: '7' | '30' | '90' | 'all'; who: string; k: string; cat: string; q: string }
export const ACT_PER: ReadonlyArray<readonly [ActFilter['per'], string]> = [['7', '최근 7일'], ['30', '최근 30일'], ['90', '최근 90일'], ['all', '전체 기간']];

/** 거르기 (pActLog) — 기간 · 사람 · 사업 · 종류 · 검색(내용 · 사람 · 종류 · 사업 이름) */
export function actFilter(L: readonly ActRow[], f: ActFilter, today: string, labelOf: (id: string) => string, shortOf: (k: string) => string): ActRow[] {
  const from = f.per === 'all' ? '' : addDays(today, -Number(f.per));
  const q = f.q.trim().toLowerCase();
  return L.filter((x) => (!from || x.d >= from) && (f.who === 'all' || x.who === f.who) && (f.k === 'all' || x.k === f.k) && (f.cat === 'all' || x.cat === f.cat)
    && (!q || `${x.txt} ${labelOf(x.who)} ${x.cat} ${x.k ? shortOf(x.k) : ''}`.toLowerCase().includes(q)));
}
