import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { latestSnapshot, type PmSnapshot } from '@/data/pm/pm.store';
import { pmStore } from '@/data/pm/pmStoreInstance';
import { doneInfoOf, liveOf, todayStr, type FilterCtx, type Live } from '@/domain/pm/rules';
import type { PmAgreementChange, PmDoc, PmPlanItem, PmProject, PmSubtask, PmTask, PmTaskDone, PmTaskFunctions } from '@/domain/pm/schema';
import { isDrop, lastUpdate, siteBrief, siteCtxOf, siteStage, type SiteBrief, type SiteCtx, type SiteInputs, type SiteStage } from '@/domain/pm/site';
import { taskTicketIndex, ticketDoneInfo, type PmTicket } from '@/domain/pm/ticket';
import { docOf, type DocState } from '@/domain/pm/doc';
import { reportPmSaveError } from './pmSaveBus';

/**
 * PM 화면 훅. 저장소 전체를 한 번에 읽는다 (업무 338건 — 작음).
 * 다시 읽기 (설계 5.7.3 ②, K1): 마지막으로 읽은 지 30초가 지난 뒤 이 훅을 쓰는 화면이 새로 붙을 때 (그룹웨어 기본과 같음).
 * 저장 성공 · 실패 때는 다시 읽지 않고 저장소가 가진 상태를 바로 넣음 (요청 0 — 실패 · 충돌이면 저장소가 이미 DB 를 다시 읽어 둠).
 */
const KEY = ['pm'] as const;
const SNAP_KEY = [...KEY, 'snapshot'] as const;

export function usePmSnapshot() {
  // 네트워크가 끊겼다 다시 붙을 때 저절로 다시 읽지 않음 (7-6 N4): 수정 창을 연 채 다시 읽으면 저장 계층이 '마지막으로 아는 내용'을
  // 남이 고친 값으로 바꿔, 옛 값으로 채워진 창의 저장이 ①(내용 비교)에 안 걸리고 남의 변경을 덮음 (시험: B 진행률 60 → A 창 저장으로 50).
  // 창이 열려 있는 동안 다른 다시 읽기 길(화면이 새로 붙음 · 다른 저장 실패)은 창이 화면을 덮어 생기지 않음.
  return useQuery({ queryKey: SNAP_KEY, queryFn: () => latestSnapshot(pmStore()), staleTime: 30_000, refetchOnReconnect: false });
}

/** 저장 뒤 화면에 저장소 상태를 넣음 — 읽은 시각은 그대로라 30초 세기가 이어짐 */
export function applyPmSnapshot(qc: QueryClient) {
  qc.setQueryData(SNAP_KEY, pmStore().peek().snap, { updatedAt: qc.getQueryState(SNAP_KEY)?.dataUpdatedAt });
}

/** 화면에서 여러 번 쓰는 파생값 — 업무별 상태·실적(티켓 반영), 완료 기록, 세부 작업 묶음, 티켓 색인 */
export interface PmDerived {
  snap: PmSnapshot;
  today: string;
  liveMap: Map<string, Live>;
  doneMap: Map<string, PmTaskDone>;
  fnMap: Map<string, PmTaskFunctions>;
  subsByTask: Map<string, PmSubtask[]>;
  taskMap: Map<string, PmTask>;
  /** 업무 ID → 업무 티켓 (취소·세부·옛 티켓 제외) */
  taskTicket: Map<string, PmTicket>;
  ticketMap: Map<string, PmTicket>;
  ctx: FilterCtx;
  /** 산출물 상태 (4단계, 데모 docOf) — 고른 기록 → 업무 티켓 파일 → 미작성 */
  docOf: (t: PmTask) => DocState;
}

export function usePmDerived(nameOf?: (id: string) => string): PmDerived | null {
  const q = usePmSnapshot();
  const snap = q.data;
  return useMemo(() => {
    if (!snap) return null;
    const today = todayStr();
    const taskTicket = taskTicketIndex(snap.tickets);
    const ticketMap = new Map(snap.tickets.map((x) => [x.no, x]));
    const liveMap = new Map(snap.tasks.map((t) => [t.id, liveOf(t, taskTicket.get(t.id))]));
    const doneMap = new Map(snap.done.map((d) => [d.id, d]));
    const fnMap = new Map(snap.functions.map((f) => [f.id, f]));
    const subsByTask = new Map<string, PmSubtask[]>();
    for (const s of [...snap.subtasks].sort((a, b) => a.order - b.order)) {
      const a = subsByTask.get(s.taskId) ?? [];
      a.push(s);
      subsByTask.set(s.taskId, a);
    }
    const taskMap = new Map(snap.tasks.map((t) => [t.id, t]));
    const ctx: FilterCtx = {
      today,
      liveMap,
      ticketed: new Set(taskTicket.keys()),
      // 언제·누가 완료: 직접 완료 기록 → 업무 티켓 승인 → 변경 이력 (doneInfo)
      doneInfo: (t) => {
        const l = liveMap.get(t.id) ?? liveOf(t);
        const own = d0(t, l);
        if (own && own.date) return own;
        const tk = ticketDoneInfo(taskTicket.get(t.id));
        return tk ? { date: tk.date, by: tk.by, prevPct: null, ticketNo: tk.ticketNo } : own;
      },
      nameOf,
    };
    function d0(t: PmTask, l: Live) { return doneInfoOf(t, l, doneMap, snap!.logs); }
    const docMap = new Map(snap.docs.map((x) => [x.id, x]));
    const docState = (t: PmTask) => docOf(t, docMap, taskTicket.get(t.id));
    return { snap, today, liveMap, doneMap, fnMap, subsByTask, taskMap, taskTicket, ticketMap, ctx, docOf: docState };
  }, [snap, nameOf]);
}

function useApply() {
  const qc = useQueryClient();
  return () => applyPmSnapshot(qc);
}

export function usePmMutations(me: string, nameOf?: (id: string) => string) {
  const done = useApply();
  const s = pmStore();
  const nm = nameOf ?? ((x: string) => x);
  const m = <A, R = unknown>(fn: (a: A) => Promise<R>) => useMutation({ mutationFn: fn, onSuccess: done, onError: (e) => { reportPmSaveError(e); done(); } });
  return {
    addTask: m((t: PmTask) => s.addTask(t, me)),
    updateTask: m(({ id, next }: { id: string; next: PmTask }) => s.updateTask(id, next, me, nameOf)),
    bulkUpdate: m((items: Array<{ next: PmTask; summary: string }>) => s.bulkUpdate(items, me)),
    setProgress: m(({ id, pct, why }: { id: string; pct: number; why: string }) => s.setProgress(id, pct, why, me)),
    addSubtask: m(({ taskId, text, assigneeId, due, est }: { taskId: string; text: string; assigneeId: string; due: string; est?: number }) => s.addSubtask(taskId, text, assigneeId, due, me, todayStr(), est ?? 0)),
    updateSubtask: m(({ id, patch }: { id: string; patch: Partial<Omit<PmSubtask, 'id' | 'taskId' | 'doneDate' | 'doneBy'>> }) => s.updateSubtask(id, patch, me)),
    removeSubtask: m((id: string) => s.removeSubtask(id)),
    // 업무계획 (3-6)
    setPlanDay: m(({ date, items, who }: { date: string; items: PmPlanItem[]; who?: string }) => s.setPlanDay(who ?? me, date, items)),
    resetBaseline: m(({ projectId, label }: { projectId: string; label: string }) => s.resetBaseline(projectId, label, me)),
    // 티켓
    issueTickets: m((list: PmTicket[]) => s.issueTickets(list)),
    moveTicket: m(({ no, to, cmt }: { no: string; to: PmTicket['status']; cmt: string }) => s.moveTicket(no, to, cmt, me, nm)),
    putTicket: m((x: PmTicket) => s.putTicket(x)),
    commentTicket: m(({ no, text }: { no: string; text: string }) => s.commentTicket(no, text, me)),
    addTicketFile: m(({ no, name }: { no: string; name: string }) => s.addTicketFile(no, name, me)),
    removeTicketFile: m(({ no, index }: { no: string; index: number }) => s.removeTicketFile(no, index, me)),
    // 6단계: 사업 등록 · 수정 · 삭제
    addProject: m(({ p, tpl, keepPeople }: { p: PmProject; tpl: string; keepPeople: boolean }) => s.addProject(p, tpl, keepPeople, me)),
    updateProject: m((p: PmProject) => s.updateProject(p, me)),
    removeProject: m((id: string) => s.removeProject(id, me)),
    // 6-2: 기준정보
    setTlinks: m((pairs: Array<[string, string | null]>) => s.setTlinks(pairs)),
    addStdToProject: m(({ projectId, rows, note }: { projectId: string; rows: Array<{ stdId: string; code?: string; start?: string; end?: string }>; note: string }) => s.addStdToProject(projectId, rows, note, me)),
    stdFromTask: m((taskId: string) => s.stdFromTask(taskId)),
    saveCode: m((c: Parameters<typeof s.saveCode>[0]) => s.saveCode(c, me)),
    removeCode: m((id: string) => s.removeCode(id)),
    moveStage: m(({ id, dir }: { id: string; dir: -1 | 1 }) => s.moveStage(id, dir)),
    moveStd: m(({ id, dir }: { id: string; dir: -1 | 1 }) => s.moveStd(id, dir)),
    saveStd: m((x: Parameters<typeof s.saveStd>[0]) => s.saveStd(x)),
    removeStd: m((id: string) => s.removeStd(id)),
    saveOrg: m((o: Parameters<typeof s.saveOrg>[0]) => s.saveOrg(o)),
    removeOrg: m((id: string) => s.removeOrg(id)),
    // 6-4 지원 기준 · 단가 · 품목 · 단가
    saveMoneyCfg: m((c: Parameters<typeof s.saveMoneyCfg>[0]) => s.saveMoneyCfg(c)),
    saveFundRule: m((r: Parameters<typeof s.saveFundRule>[0]) => s.saveFundRule(r)),
    removeFundRule: m((id: string) => s.removeFundRule(id)),
    saveItem: m((it: Parameters<typeof s.saveItem>[0]) => s.saveItem(it)),
    removeItem: m((id: string) => s.removeItem(id)),
    // 6-5 견적 작성
    saveQuote: m(({ E, src }: { E: Parameters<typeof s.saveQuote>[0]; src: string }) => s.saveQuote(E, src)),
    removeContract: m((id: string) => s.removeContract(id)),
    registerItems: m(({ lines, src, date }: { lines: Parameters<typeof s.registerItems>[0]; src: string; date: string }) => s.registerItems(lines, src, date)),
    // 6-6 사업별 수익 · 손익
    saveFund: m((f: Parameters<typeof s.saveFund>[0]) => s.saveFund(f)),
    savePay: m((p: Parameters<typeof s.savePay>[0]) => s.savePay(p)),
    removePay: m((id: string) => s.removePay(id)),
    saveCost: m((c: Parameters<typeof s.saveCost>[0]) => s.saveCost(c)),
    removeCost: m((id: string) => s.removeCost(id)),
    saveOh: m(({ m: mo, amt, memo, def }: { m: string; amt: number | null; memo: string; def: number | null }) => s.saveOh(mo, amt, memo, def, me)),
    completeTasks: m(({ ids, note }: { ids: string[]; note: string }) => s.completeTasks(ids, note, me)),
    setTaskDates: m(({ items, note }: { items: Array<{ id: string; start: string; end: string }>; note: string }) => s.setTaskDates(items, note, me)),
    // 5단계: 이슈 (여러 화면에서 등록 창을 열어서 여기 둠)
    addIssue: m((x: Parameters<typeof s.addIssue>[0]) => s.addIssue(x, me)),
    updateIssue: m(({ id, x }: { id: string; x: Parameters<typeof s.updateIssue>[1] }) => s.updateIssue(id, x)),
    removeIssue: m((id: string) => s.removeIssue(id)),
    escalateIssue: m((id: string) => s.escalateIssue(id)),
    // 5단계: 회의록 · 액션 아이템
    addMeeting: m((x: Parameters<typeof s.addMeeting>[0]) => s.addMeeting(x, me)),
    updateMeeting: m(({ id, x }: { id: string; x: Parameters<typeof s.updateMeeting>[1] }) => s.updateMeeting(id, x)),
    removeMeeting: m((id: string) => s.removeMeeting(id)),
    addAction: m((x: Parameters<typeof s.addAction>[0]) => s.addAction(x, me)),
    updateAction: m(({ id, x }: { id: string; x: Parameters<typeof s.updateAction>[1] }) => s.updateAction(id, x, me)),
    removeAction: m((id: string) => s.removeAction(id)),
    setActionDone: m(({ id, done }: { id: string; done: boolean }) => s.setActionDone(id, done, me)),
    // 5단계: 주간 진행률 · 보고서
    setReport: m(({ projectId, week, patch }: { projectId: string; week: string; patch: { note?: string; req?: string } }) => s.setReport(projectId, week, patch, me)),
    sendUpdRequest: m(({ whoId, projectId }: { whoId: string; projectId: string }) => s.sendUpdRequest(whoId, projectId, me)),
  };
}

// ── 사업 현황 (3단계) ─────────────────────────────────

export interface PmSiteRow {
  p: PmProject;
  c: SiteCtx;
  b: SiteBrief;
  stage: SiteStage;
}

/** 사업마다 기한·단계·신호 계산 (통합 사업 현황·사업별 화면). 업무가 없고 협약 시작일도 없는 사업은 뺌 (데모 sitesAll) */
export function usePmSites(d: PmDerived | null): { rows: PmSiteRow[]; all: PmSiteRow[] } | null {
  return useMemo(() => {
    if (!d) return null;
    const { snap, today, liveMap } = d;
    const X: SiteInputs = {
      tasks: snap.tasks, liveMap, plans: snap.plans, gov: snap.gov, planChecks: snap.planChecks, govLinks: snap.govLinks,
      agreements: snap.agreements, baselines: snap.baselines, issues: snap.issues, reports: snap.reports,
    };
    const all = snap.projects
      .map((p) => {
        const c = siteCtxOf(p, X, today);
        const tkDates = snap.tickets.filter((x) => x.projectId === p.id).flatMap((x) => x.hist.map((h) => h.date));
        const upd = lastUpdate(snap.baseDate, snap.logs.filter((l) => l.projectId === p.id), tkDates, today);
        return { p, c, b: siteBrief(c, upd), stage: siteStage(c) };
      })
      .filter((r) => r.c.ts.length || r.p.start)
      // 사업 번호 순 (데모 S.sites 순서: P2 신광 · P3 효광 · P4 한일 …)
      .sort((a, b) => Number(a.p.id.replace(/\D/g, '')) - Number(b.p.id.replace(/\D/g, '')));
    return { all, rows: all.filter((r) => !isDrop(r.p)) };
  }, [d]);
}

export function usePmSiteMutations(me: string) {
  const done = useApply();
  const s = pmStore();
  const m = <A, R = unknown>(fn: (a: A) => Promise<R>) => useMutation({ mutationFn: fn, onSuccess: done, onError: (e) => { reportPmSaveError(e); done(); } });
  return {
    checkDeadlines: m(({ items, date, bulk }: { items: Array<{ projectId: string; kind: 'gov' | 'plan'; id: string }>; date: string; bulk: boolean }) => s.checkDeadlines(items, date, me, bulk)),
    uncheckDeadline: m(({ projectId, kind, id }: { projectId: string; kind: 'gov' | 'plan'; id: string }) => s.uncheckDeadline(projectId, kind, id)),
    setGovResult: m(({ projectId, itemId, x }: { projectId: string; itemId: string; x: Parameters<typeof s.setGovResult>[2] }) => s.setGovResult(projectId, itemId, x, me)),
    removeGovResult: m(({ projectId, itemId }: { projectId: string; itemId: string }) => s.removeGovResult(projectId, itemId)),
    setFixItemState: m(({ projectId, itemId, fixId, action, note }: { projectId: string; itemId: string; fixId: string; action: '조치 완료' | '확인' | '반려' | '조치 전'; note: string }) => s.setFixItemState(projectId, itemId, fixId, action, note, me)),
    saveAgreement: m((x: PmAgreementChange) => s.saveAgreement(x, me)),
    removeAgreement: m((id: string) => s.removeAgreement(id)),
    setGovLink: m(({ projectId, itemId, taskIds }: { projectId: string; itemId: string; taskIds: string[] | null }) => s.setGovLink(projectId, itemId, taskIds)),
    setTaskDates: m(({ items, note }: { items: Array<{ id: string; start: string; end: string }>; note: string }) => s.setTaskDates(items, note, me)),
    setBidResult: m(({ projectId, v }: { projectId: string; v: '' | '선정' | '탈락' }) => s.setBidResult(projectId, v, me)),
    // 팀 현황 (3-4)
    setLoadMax: m((v: number) => s.setLoadMax(v)),
    // 내 업무 (3-5)
    setLater: m(({ taskId, on }: { taskId: string; on: boolean }) => s.setLater(me, taskId, on)),
    markNoChange: m((taskIds: string[]) => s.markNoChange(taskIds, me)),
    approveMilestone: m(({ taskId, byName }: { taskId: string; byName: string }) => s.approveMilestone(taskId, me, byName)),
    setActionDone: m(({ id, done }: { id: string; done: boolean }) => s.setActionDone(id, done, me)),
    // 업무계획 (3-6)
    ensureCarryFrom: m((date: string) => s.ensureCarryFrom(date)),
    addPlanRep: m(({ wd, text }: { wd: number[]; text: string }) => s.addPlanRep(me, wd, text)),
    removePlanRep: m((index: number) => s.removePlanRep(me, index)),
    savePdfDraft: m((x: { date: string; dept: string; name: string; rows: Array<[string, string, string]>; at: string }) => s.savePdfDraft({ ...x, who: me })),
    removePdfDraft: m((date: string) => s.removePdfDraft(me, date)),
    // 3-7: 성과지표 · 알림 · 즐겨찾기
    saveKpiDef: m((x: Parameters<typeof s.saveKpiDef>[0]) => s.saveKpiDef(x)),
    removeKpiDef: m((id: string) => s.removeKpiDef(id)),
    saveKpiMeas: m((x: Parameters<typeof s.saveKpiMeas>[0]) => s.saveKpiMeas(x, me)),
    removeKpiMeas: m((id: string) => s.removeKpiMeas(id)),
    addAiMeas: m((x: Parameters<typeof s.addAiMeas>[0]) => s.addAiMeas(x, me)),
    setSeen: m(({ txt, on }: { txt: string; on: boolean }) => s.setSeen(me, txt, on)),
    toggleFav: m((f: { v: string; k: string }) => s.toggleFav(me, f)),
    // 4단계: 산출물
    setDoc: m(({ taskId, st }: { taskId: string; st: PmDoc['st'] }) => s.setDoc(taskId, st, me)),
    uploadDoc: m(({ taskId, name }: { taskId: string; name: string }) => s.uploadDoc(taskId, name, me)),
    // 4단계: 요구사항(CR)
    addCr: m((x: Parameters<typeof s.addCr>[0]) => s.addCr(x, me)),
    updateCr: m(({ id, x }: { id: string; x: Parameters<typeof s.updateCr>[1] }) => s.updateCr(id, x)),
    removeCr: m((id: string) => s.removeCr(id)),
    reviewCr: m(({ id, decision, comment }: { id: string; decision: '승인' | '반려'; comment: string }) => s.reviewCr(id, decision, comment, me)),
    linkCrTask: m(({ id, taskId }: { id: string; taskId: string }) => s.linkCrTask(id, taskId)),
  };
}
