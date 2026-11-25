import { addDays, diffDays, isDone, liveOf, mdAvgRaw, monthDay, planPct, siteStatusOf, type Live, type PmSiteStatus } from './rules';
import type {
  PmAction, PmAgreementChange, PmBaseline, PmChangeLog, PmGovLink, PmGovRecord, PmIssue, PmMilestoneOk,
  PmPlanCheck, PmProject, PmTask,
} from './schema';

/**
 * 사업 현황 계산 — 통합 사업 현황·사업별 화면·알림이 같이 쓰는 기한·단계·신호 (3단계).
 * 데모 코드를 그대로 옮긴 순수 함수 (괄호 = 데모 함수, 11/24 데모 기준). DB·화면을 모른다.
 * ([[2026-11-24-pms-port-design]] §3.3 · §5.3)
 *
 * 기한 = 관리기준(세부관리기준 공통 일정) + 계획서 약속 + 마일스톤 + 수주 + 사후관리.
 * 관리기준·계획서 약속은 **협약일·종료일과 계획서 내장 데이터로 계산** — 사람이 입력하는 칸이 아니다.
 */

// ── 날짜 ─────────────────────────────────────────────

/** n개월 뒤 — JS Date.setMonth 그대로 (8/31 + 1개월 = 10/1, 데모 addMonths 와 같게) */
export function addMonths(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number);
  const x = new Date(y, m - 1, d);
  x.setMonth(x.getMonth() + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
/** D-n / D-Day / D+n (dday) */
export function dday(s: string, today: string) {
  const n = diffDays(today, s);
  return n === 0 ? 'D-Day' : n > 0 ? `D-${n}` : `D+${-n}`;
}
/** 오늘 / 어제 / n일 전 (agoTxt) */
export function agoText(d: string, today: string) {
  if (!d) return '기록 없음';
  const n = diffDays(d, today);
  return n <= 0 ? '오늘' : n === 1 ? '어제' : `${n}일 전`;
}
/** 그 주 월요일 (weekStart) */
export function weekStart(s: string, off = 0) {
  const [y, m, d] = s.split('-').map(Number);
  const x = new Date(y, m - 1, d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7) + off * 7);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

// ── 사업계획서 내장 데이터 (plan-data) ────────────────

export interface PmPlanKpi { f?: string; name: string; unit?: string; base: number | string; target: number | string; w?: number; dir?: 'up' | 'down'; period?: string; method?: string; warn?: string }
export interface PmPlan {
  file?: string; doc?: string; date?: string; ver?: string; co?: string; sup?: string; no?: string;
  level?: [string, string]; region?: string; founded?: string; industry?: string; product?: string;
  goal?: string[];
  /** 비목 A~G: 칸 3개, 천원. 세 번째 칸 = 정부 (데모 사업 개요 '정부' = planSum(p, 2), 신광 1.9억 확인) */
  budget?: Record<string, [number, number, number]>;
  kpis?: PmPlanKpi[];
  post?: string;
  ai?: unknown[];
  edu?: Array<{ c: string; who: string; due: string; note?: string; pre?: string }>;
  userEdu?: string;
  revs?: unknown[];
}

/** 9.1 산업안전 · 9.2 산업보안 조치 이행계획 — 계획서 7건 공통 양식 (PLAN_SAFETY · PLAN_SECURITY) */
export const PLAN_SAFETY: ReadonlyArray<readonly [string, string, string]> = [
  ['공정 위험성 평가', 'HIRA 완료', '도입기업'], ['기계 안전 (인터록·비상정지)', '협착 사고 예방', '도입기업 · 공급기업'],
  ['화재 예방 (가연성 분진 제거)', '화재 0건', '도입기업'], ['PPE 관리 (보호구 지급·착용)', '착용률 100%', '도입기업'],
];
export const PLAN_SECURITY: ReadonlyArray<readonly [string, string, string]> = [
  ['도면·데이터 보호 (권한 최소화·암호화 저장)', '무단열람 0건', '공급기업 · 도입기업'], ['네트워크 보안 (세그멘테이션·MFA)', '취약점 조치율 100%', '공급기업'],
  ['이력 관리 (바코드·QR)', '추적 성공률 100%', '공급기업'], ['DLP (메일·USB 통제)', '유출 0건', '도입기업'],
  ['물리적 보안 (출입통제·CCTV)', '무단반출 0건', '도입기업'],
];
/** 비목 이름 (BUDGET_CODE) */
export const BUDGET_CODE: Record<string, string> = {
  A: 'S/W 개발비(A)', B: 'H/W 구입비(B)', C: 'S/W 구입비(C)', D: 'N/W 구축비(D)', E: '기타(할인)비용(E)', F: '도입기업 인력 인건비(F)', G: '클라우드 서비스 이용료(G)',
};
/** 사업비 합 (천원). i 없으면 정부+민간 현금+현물, 있으면 그 칸 (planSum) */
export const planSum = (p: PmPlan, i?: number) => Object.values(p.budget ?? {}).reduce((a, r) => a + (i == null ? r[0] + r[1] + r[2] : r[i]), 0);

// ── 업무 집계 기준 ────────────────────────────────────

/** 협약 이전(영업·제안) 단계 — 지연·알림·부하 집계에서 제외 (isPre) */
export const isPre = (t: PmTask) => /협약 이전/.test(t.stage);
/** '[FP] …' 묶음 줄 (isFP) — 새 업무 목록엔 없음 */
export const isFP = (t: PmTask) => /^\[FP\]/.test(t.name);
const EXEC_RE = /협약 이전|프로젝트관리/;
/** 탈락 사업 — 현황·알림에서 빠짐 (isDrop) */
export const isDrop = (p: PmProject) => p.bidRes === '탈락';
/** 관리기준 TASK 이름 머리 (GOV_TASK_TAG) */
export const GOV_TASK_TAG = '[관리기준] ';

/** 사업 1개 계산에 필요한 것 */
export interface SiteCtx {
  p: PmProject;
  /** 이 사업 업무 (화면 순서) */
  ts: readonly PmTask[];
  live: (t: PmTask) => Live;
  today: string;
  plan: PmPlan | null;
  /** 관리기준 기록 itemId → 기록 */
  gov: ReadonlyMap<string, PmGovRecord>;
  /** 계획서 약속 체크 dutyId → 기록 */
  planChk: ReadonlyMap<string, PmPlanCheck>;
  /** 관리기준 필수 TASK 직접 연결 itemId → 업무 ID */
  govLink: ReadonlyMap<string, readonly string[]>;
  agr: readonly PmAgreementChange[];
  baseline: PmBaseline | null;
  /** 이 사업 이슈 */
  issues: readonly PmIssue[];
}

const done = (c: SiteCtx, t: PmTask) => isDone(c.live(t));
const late = (c: SiteCtx, t: PmTask) => !!t.end && t.end < c.today && !done(c, t);
const nowOf = (c: SiteCtx, t: PmTask) => !!t.start && t.start <= c.today && t.end >= c.today && !done(c, t);
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export interface SiteStats {
  n: number;
  /** 실적 % (MD 가중, 반올림 안 함) */
  act: number;
  /** 오늘 계획 % (단순 평균) */
  plan: number;
  gap: number;
  /** 지연 업무 (협약 이전·FP 제외) */
  late: PmTask[];
  /** 마일스톤 (종료일 순) */
  ms: PmTask[];
}

/** 사업 진척 (stats 2349) — 협약 이전·프로젝트관리 단계와 [FP] 줄을 빼고, 없으면 전부 */
export function siteStats(c: SiteCtx): SiteStats {
  const all = c.ts.filter((t) => !t.excludeFromProgress);
  const ex = all.filter((t) => !EXEC_RE.test(t.stage) && !isFP(t));
  const base = ex.length ? ex : all;
  const lm = new Map(base.map((t) => [t.id, c.live(t)]));
  const act = base.length ? mdAvgRaw(base, lm) : 0;
  const plan = avg(base.map((t) => planPct(t, c.today)));
  return {
    n: c.ts.length,
    act,
    plan,
    gap: act - plan,
    late: c.ts.filter((t) => late(c, t) && !isPre(t) && !isFP(t) && !isDrop(c.p)),
    ms: c.ts.filter((t) => t.milestone).sort((a, b) => (a.end < b.end ? -1 : 1)),
  };
}

/** 사업 상태 (siteStatus 2370) */
export function siteStatusFull(c: SiteCtx, st = siteStats(c)): PmSiteStatus {
  if (c.p.closed) return '종료';
  if (!st.n) return '준비';
  return siteStatusOf(st.act, st.plan);
}

// ── 관리기준 (세부관리기준 제1장 공통관리사항) ─────────

export const GOV_BIZ = /정부일반형|부처협업형|제조AI/;
/** 서류 내는 일은 실제 기한 7일 전을 내부 마감으로 (GOV_INNER) */
export const GOV_INNER = 7;
/** 나쁜 판정 (GOV_BAD) */
export const GOV_BAD = ['중단', '부적정', '실패'];
export type Side = 'buyer' | 'us' | 'both';
export const SIDE_TEXT: Partial<Record<Side, string>> = { buyer: '도입기업', both: '함께' };

export interface GovItem {
  id: string;
  t: string;
  who: string;
  side: Side;
  /** 서류 제출 항목 → 내부 마감 */
  sub?: boolean;
  law: string;
  dueTxt: string;
  due: string;
  inner?: string;
  /** 규정 기한 (중간점검: 협약 후 3개월) */
  lawDue?: string;
  /** 같은 일을 하는 업무 (자동 완료) */
  w?: PmTask;
  /** 판정 칸 */
  res?: string[];
  /** 후속 기한이면 원래 항목 */
  follow?: string;
}

/** 관리기준 필수 TASK (GOV_WBS) — 그 일을 하는 업무를 이름·산출물로 찾음. post = 협약 종료 뒤 일 */
export const GOV_WBS: ReadonlyArray<{ id: string; short: string; t: string; re: RegExp; out?: boolean; post?: boolean }> = [
  { id: 'g_start', short: '착수계', t: '착수계 · 기업부담금 · 이행보증보험 제출', re: /착수계|착수보고/, out: true },
  { id: 'g_mid', short: '중간점검', t: '중간보고서 등록 · 중간점검 대응', re: /중간점검|중간보고/ },
  { id: 'g_ready', short: '최종점검 준비', t: '최종점검 준비 (실데이터 · 로그 · 운영현황보고서 · 최종검수)', re: /최종점검 준비|감리 준비|운영현황보고서|최종검수/, out: true },
  { id: 'g_done', short: '완료보고', t: '완료보고서 · 증빙 서류 제출', re: /완료보고/ },
  { id: 'g_audit', short: '감리 최종점검', t: '감리 최종점검 대응', re: /^(?!.*준비).*(최종점검|감리|완료점검)/, post: true },
  { id: 'g_settle', short: '사업비 정산', t: '사업비 집행 · 증빙 · 정산 서류', re: /정산|사업비 집행|RCMS/, post: true },
  { id: 'g_handover', short: '인수인계 · 기술임치', t: '시스템 인수인계서 · 기술임치 제출', re: /기술임치|인수인계서/, post: true },
];
/** 보완 → 원래 항목 (GOV_FOLLOW_OF) */
export const GOV_FOLLOW_OF: Record<string, string> = { g_mid_fix: 'g_mid', g_audit_fix: 'g_audit', g_as: 'g_eval' };

/** 항목에 연결된 업무 — 직접 고친 것 우선 (govLinkTasks) */
export function govLinkTasks(c: SiteCtx, r: (typeof GOV_WBS)[number]): PmTask[] {
  const man = c.govLink.get(r.id);
  if (man) return man.map((id) => c.ts.find((t) => t.id === id)).filter((t): t is PmTask => !!t);
  return c.ts.filter((t) => !isPre(t) && (r.re.test(t.name) || (!!r.out && r.re.test(t.output))));
}

/** 관리기준 기한 목록 (govItems 7068). 정부일반형·부처협업형·제조AI 이고 협약 시작·종료일이 있을 때만, 아니면 null */
export function govItems(c: SiteCtx): GovItem[] | null {
  const s = c.p;
  if (!s.start || !s.end || !GOV_BIZ.test(s.biz)) return null;
  const ts = c.ts.filter((t) => !isPre(t));
  const find = (re: RegExp) => ts.find((t) => re.test(t.name));
  const R = c.gov;
  const rd = (id: string) => { const r = R.get(id); return r && r.v ? r.date : null; };
  const doneD = R.get('g_done')?.date;
  const audD = rd('g_audit_fix') || rd('g_audit');
  // 중간점검은 운영기관 일정에 따라 바뀜 → 업무 목록 일정을 따름 ('중간점검·완료점검'처럼 묶인 업무는 시작일)
  const midBase = addMonths(s.start, 3);
  const midTs = govLinkTasks(c, GOV_WBS.find((r) => r.id === 'g_mid')!).filter((t) => t.end);
  const midD = midTs.length ? midTs.map((t) => (/완료점검/.test(t.name) ? t.start || t.end : t.end)).sort().pop()! : null;
  const L: GovItem[] = [
    { id: 'g_start', t: '착수계 · 기업부담금 납부 · 이행보증보험 제출', who: '도입기업', side: 'buyer', sub: true, law: '26조', dueTxt: '협약 후 14일', due: addDays(s.start, 14), w: find(/착수계/) },
    { id: 'g_bond', t: 'SW개발비 선급금 보증보험 제출 (보증기간 협약기간 + 3개월)', who: '공급기업', side: 'us', sub: true, law: '26조', dueTxt: '협약 후 14일', due: addDays(s.start, 14) },
    { id: 'g_mid', t: '중간보고서(사업비 사용실적 포함) 등록 · 중간점검', who: '도입기업 (공급기업 지원)', side: 'buyer', sub: true, law: '29조', dueTxt: midD ? `업무 목록 일정 기준 (규정: 협약 후 3개월 ${monthDay(midBase)})` : '협약 후 3개월 이내', due: midD || midBase, lawDue: midBase, w: ts.find((t) => /중간점검/.test(t.name) && !/완료점검/.test(t.name)), res: ['계속', '보완', '중단'] },
    { id: 'g_ready', t: '최종점검 준비 — 실데이터 입력 · 로그 수집 · 운영현황보고서 · 시연 시나리오', who: 'PM · 개발팀', side: 'us', law: '31조③', dueTxt: '구축완료 30일 전 (데이터 · 기능이 정상이 아니면 점검 중단)', due: addDays(s.end, -30) },
    { id: 'g_done', t: '완료보고서 · 사업비 사용실적 · 운영현황보고서 · 로그 · 산출물 · 하자보증보험 제출', who: '도입기업 · 공급기업', side: 'both', sub: true, law: '31조①', dueTxt: '구축완료 후 14일 (지연사유서 제출 시 30일)', due: addDays(s.end, 14), w: find(/완료보고/) },
    { id: 'g_audit', t: '감리 최종점검 (현장 2일) — 판정 적정 · 보완 · 부적정', who: '감리기관 · PM 대응', side: 'us', law: '31조③④⑤', dueTxt: doneD ? `완료보고서 제출(${monthDay(doneD)}) 후 30일 이내` : '완료보고서 제출 후 30일 이내 (예상)', due: doneD ? addDays(doneD, 30) : addDays(s.end, 44), res: ['적정', '보완', '부적정'] },
    { id: 'g_settle', t: '사업비 정산 서류 제출', who: '도입기업', side: 'buyer', sub: true, law: '35조', dueTxt: '협약 종료 후 1개월', due: addMonths(s.end, 1) },
    { id: 'g_eval', t: '최종평가 (성공 · 보완 · 실패)', who: '운영기관 → 공급기업', side: 'us', law: '32조', dueTxt: audD ? `최종점검 결과 통보(${monthDay(audD)}) 후 30일 이내` : '최종점검 결과 통보 후 30일 이내 (예상)', due: audD ? addDays(audD, 30) : addDays(s.end, 88), res: ['성공', '보완', '실패'] },
  ];
  // 점검 결과에 따라 생기는 후속 기한 (29·31·32·33·34조) — 결과를 기록해야 나타남
  const fx = (id: string, def: string) => R.get(id)?.fix || def;
  const v = (id: string) => R.get(id)?.v ?? '';
  const after = (id: string, x: Omit<GovItem, 'follow'>) => L.splice(L.findIndex((g) => g.id === id) + 1, 0, { ...x, follow: id });
  if (v('g_mid') === '보완') after('g_mid', { id: 'g_mid_fix', t: '중간점검 보완 — 개선 조치 후 수정 중간보고서 제출 · 재점검', who: '도입기업 (공급기업 지원)', side: 'buyer', law: '29조', dueTxt: R.get('g_mid')!.fix ? '직접 지정한 기한' : `보완 통보(${monthDay(rd('g_mid')!)}) 후 30일`, due: fx('g_mid', addDays(rd('g_mid')!, 30)), res: ['계속', '중단'] });
  if (v('g_audit') === '보완') after('g_audit', { id: 'g_audit_fix', t: '최종점검 보완 — 시정조치계획서 → 조치 → 시정조치결과서 · 최종완료보고서 (현장 1일 재확인)', who: '공급기업 · 도입기업', side: 'both', law: '31조⑥⑦', dueTxt: R.get('g_audit')!.fix ? '직접 지정한 기한' : `보완 통보(${monthDay(rd('g_audit')!)}) 후 30일`, due: fx('g_audit', addDays(rd('g_audit')!, 30)), res: ['적정', '부적정'] });
  const handover = (from: string) => ({ id: 'g_handover', t: '시스템 인수인계서 · 기술임치 계약서 · 임치증 제출', who: '공급기업 · 도입기업', side: 'both' as Side, sub: true, law: '32조④', dueTxt: `성공 통보(${monthDay(rd(from)!)}) 후 7일`, due: addDays(rd(from)!, 7) });
  if (v('g_eval') === '성공') after('g_eval', handover('g_eval'));
  if (v('g_eval') === '보완') {
    const asEnd = fx('g_eval', addMonths(s.end, 6));
    after('g_eval', { id: 'g_reeval', t: '최종재평가 — 집중AS 종료 후 14일 안에 서류 제출 (성공 · 실패)', who: '공급기업 · 도입기업', side: 'both', sub: true, law: '34조', dueTxt: `집중AS 종료(${monthDay(asEnd)}) 후 14일`, due: addDays(asEnd, 14), res: ['성공', '실패'] });
    after('g_eval', { id: 'g_as', t: '집중AS — 보완 판정 사항 조치', who: '공급기업', side: 'us', law: '33조', dueTxt: R.get('g_eval')!.fix ? '직접 지정한 기한' : '구축완료 후 6개월까지', due: asEnd });
    if (v('g_reeval') === '성공') after('g_reeval', handover('g_reeval'));
  }
  for (const g of L) if (g.sub && g.due) g.inner = addDays(g.due, -GOV_INNER);
  return L;
}

/** 완료 기록 — 직접 기록 → 연결된 업무가 모두 완료면 자동 완료 (govRec) */
export type GovDone = { rec: PmGovRecord } | { autoCodes: string } | null;
export function govRec(c: SiteCtx, g: GovItem): GovDone {
  const r = c.gov.get(g.id);
  if (r) return { rec: r };
  const man = c.govLink.get(g.id);
  const ws = man ? man.map((id) => c.ts.find((t) => t.id === id)).filter((t): t is PmTask => !!t) : g.w ? [g.w] : [];
  return ws.length && ws.every((t) => done(c, t)) ? { autoCodes: ws.map((t) => t.code).join(', ') } : null;
}

export type GovWbsState = 'ok' | 'nodate' | 'post' | 'none';
/** 관리기준 필수 TASK 점검 (govWbsCheck) — 정부사업이 아니면 null */
export function govWbsCheck(c: SiteCtx) {
  if (!govItems(c)) return null;
  return GOV_WBS.map((r) => {
    const ts = govLinkTasks(c, r);
    const st: GovWbsState = ts.length ? (ts.some((t) => t.end) ? 'ok' : 'nodate') : r.post ? 'post' : 'none';
    return { ...r, ts, man: c.govLink.has(r.id), st };
  });
}

// ── 계획서 약속 ───────────────────────────────────────

export interface PlanDuty { id: string; cat: string; t: string; who: string; dueTxt: string; due: string; pre?: string; after?: boolean }

/** 계획서 약속 사항·기한 (planDuties 6964) */
export function planDuties(c: SiteCtx): PlanDuty[] {
  const p = c.plan;
  const s = c.p;
  if (!p) return [];
  // 중간점검 시점: 업무 목록의 중간점검 업무 종료일 ('중간점검·완료점검'처럼 묶인 업무는 시작일). 없으면 미정
  const midT = c.ts.find((t) => !/협약 이전/.test(t.stage) && /중간점검/.test(t.name));
  const midEnd = !midT ? '' : /완료점검/.test(midT.name) ? midT.start : midT.end || midT.start;
  const due = (txt: string) => (/협약 후 1개월/.test(txt) ? (s.start ? addDays(s.start, 30) : '') : /중간/.test(txt) ? midEnd : /완료점검|구축기간|종료/.test(txt) ? s.end : '');
  const out: PlanDuty[] = [];
  (p.edu ?? []).forEach((e, i) => out.push({ id: `edu${i}`, cat: '교육 수료 (계획서 7)', t: e.c + (e.note ? ` — ${e.note}` : ''), who: e.who, dueTxt: e.due, due: due(e.due), pre: e.pre }));
  if (p.userEdu) out.push({ id: 'uedu', cat: '사용자 교육 (계획서 6.1)', t: `사용자 교육·훈련 ${p.userEdu} 실시 · 교육실시관리서 작성`, who: '공급기업 → 도입기업 사용자', dueTxt: '완료점검 이전', due: s.end });
  out.push({ id: 'kpiBase', cat: '성과지표 (계획서 1.5)', t: '구축 전 성과지표 측정 근거자료 보관 (산식·원자료)', who: 'PM · 도입기업', dueTxt: '중간점검 이전', due: midEnd });
  out.push({ id: 'kpiPost', cat: '성과지표 (계획서 1.5)', t: `구축 후 성과지표 실측${p.post ? ` — ${p.post}` : ''}`, who: 'PM · 도입기업', dueTxt: '완료점검 이전', due: s.end });
  if ((p.ai ?? []).length) out.push({ id: 'aiPerf', cat: 'AI 성능 (계획서 2.6)', t: `AI 성능목표 ${p.ai!.length}개 항목 검증 자료 확보`, who: 'PM · AI 개발', dueTxt: '완료점검 이전 (일부 항목은 운영 6개월 후)', due: s.end });
  PLAN_SAFETY.forEach((x, i) => out.push({ id: `safe${i}`, cat: '산업안전 (계획서 9.1)', t: `${x[0]} — 목표 ${x[1]}`, who: x[2], dueTxt: '구축기간 내', due: s.end }));
  PLAN_SECURITY.forEach((x, i) => out.push({ id: `sec${i}`, cat: '산업보안 (계획서 9.2)', t: `${x[0]} — 목표 ${x[1]}`, who: x[2], dueTxt: '구축기간 내', due: s.end }));
  out.push({ id: 'settle', cat: '정산 (계획서 4.1)', t: '기술임치 · 회계정산 · 교육비 집행 (기타비용 E 필수 계상 항목)', who: 'PM · 경영지원', dueTxt: '사업 종료 전', due: s.end });
  out.push({ id: 'maint', cat: '유지보수 (계획서 6.2)', t: '무상 하자보수 12개월 (최종 검수일부터) · 장애 4시간 내 복구 · 월 1회 정기점검', who: '공급기업', dueTxt: '최종검수 후 12개월', due: s.end ? addDays(s.end, 365) : '', after: true });
  return out;
}
/** 약속 완료 기록 — 체크 → 계획서에 '이미 함'(pre) 표시 (dutyRec) */
export function dutyRec(c: SiteCtx, d: PlanDuty): { check: PmPlanCheck } | { pre: string } | null {
  const r = c.planChk.get(d.id);
  if (!r && d.pre) return { pre: d.pre };
  return r ? { check: r } : null;
}
/** 누가 하는 일 (dutySide) */
export const dutySide = (who: string): Side => (/도입기업/.test(who) ? (/PM|공급/.test(who) ? 'both' : 'buyer') : 'us');

// ── 수주 · 사후관리 ───────────────────────────────────

export interface PreStep { id: string; nm: string; ts: PmTask[]; n: number; a: string; z: string; st: '완료' | '지연' | '진행 중' | '시작 전' }
/** 협약 이전 업무를 단계별로 묶음 (preSteps) */
export function preSteps(c: SiteCtx): PreStep[] {
  const ts = c.ts.filter(isPre);
  const G = new Map<string, { id: string; nm: string; ts: PmTask[] }>();
  for (const t of ts) {
    const id = t.code.split('.').slice(0, 2).join('.');
    const nm = t.name.match(/^\[([^\]]+)\]/)?.[1] ?? t.name;
    if (!G.has(id)) G.set(id, { id, nm, ts: [] });
    G.get(id)!.ts.push(t);
  }
  return [...G.values()].map((g) => {
    const n = g.ts.filter((t) => done(c, t)).length;
    const st: PreStep['st'] = n === g.ts.length ? '완료' : g.ts.some((t) => late(c, t)) ? '지연' : g.ts.some((t) => c.live(t).pct > 0 || nowOf(c, t)) ? '진행 중' : '시작 전';
    return { ...g, n, a: g.ts.map((t) => t.start).filter(Boolean).sort()[0] ?? '', z: g.ts.map((t) => t.end).filter(Boolean).sort().pop() ?? '', st };
  });
}
interface Gate { t: string; due: string; id?: string; inner?: string }
/** 수주 단계 상태 (bidState) */
export function bidState(c: SiteCtx): { sub: string; next: Gate | null; bad?: boolean } {
  const s = c.p;
  const T = c.today;
  const P = preSteps(c);
  const cur = P.find((g) => g.st !== '완료');
  const fin = (re: RegExp) => P.find((g) => re.test(g.nm))?.st === '완료';
  const AN = { t: '공고 마감 (사업계획서 신청)', due: s.annDue };
  const EV = { t: '선정평가', due: s.evalDate };
  const ST = s.start ? { t: '협약 시작 (예정)', due: s.start } : null;
  if (s.bidRes === '탈락') return { sub: '탈락', next: null };
  if (s.bidRes === '선정') return { sub: '선정 · 협약 준비', next: ST };
  const a = s.annDue;
  const e = s.evalDate;
  const applied = P.length ? fin(/신청|사업계획서/) : !!(a && a < T);
  const evaled = P.length ? fin(/선정평가/) : false;
  if (a && !applied) return a < T ? { sub: '신청 기한 지남', next: AN, bad: true } : { sub: `신청 준비 · 마감 ${dday(a, T)}`, next: AN };
  if (e && !evaled) return e >= T ? { sub: `선정평가 준비 · ${dday(e, T)}`, next: EV } : { sub: '선정 결과 대기', next: ST };
  return { sub: cur ? cur.nm : '협약 준비', next: ST };
}
/** 하자보증 끝 (warrEnd) */
export const warrantyEnd = (p: PmProject) => (p.end && (p.warrantyM ?? 0) > 0 ? addMonths(p.end, p.warrantyM!) : '');
/** 하자·AS 요청 = 협약 종료 뒤 등록된 이슈 (asIssues) */
export const asIssues = (c: SiteCtx) => c.issues.filter((i) => c.p.end && i.date > c.p.end);

// ── 기한 모음 ─────────────────────────────────────────

export type DeadlineSrc = '관리기준' | '점검 후속' | '계획서 약속' | '마일스톤' | '수주' | '사후관리';
export interface Deadline {
  src: DeadlineSrc;
  /** 관리기준·계획서 약속 항목 id */
  id?: string;
  /** 마일스톤·수주 업무 ID */
  taskId?: string;
  due: string;
  inner?: string;
  t: string;
  sub: string;
  side: Side;
  done: boolean;
  /** 완료 체크 종류 — 'gov' 관리기준 · 'plan' 계획서 약속 (마일스톤·판정 항목은 체크 없음) */
  chk?: 'gov' | 'plan';
  /** 판정 칸 (점검) */
  res?: string[];
  gov?: GovDone;
  duty?: ReturnType<typeof dutyRec>;
  /** 원래 항목 (보완 후속) */
  pid?: string;
  /** 마일스톤 기준선 대비 일수 */
  shift?: number;
}

function bidDeadlines(c: SiteCtx): Deadline[] {
  const s = c.p;
  if (!s.start || c.today >= s.start || isDrop(s)) return [];
  const P = preSteps(c);
  const fin = (re: RegExp) => P.find((g) => re.test(g.nm))?.st === '완료';
  const tk = (re: RegExp) => c.ts.filter(isPre).find((t) => re.test(t.name))?.id;
  const L: Array<[string, string, RegExp, RegExp]> = [
    [s.annDue, '공고 마감 — 사업계획서 온라인 신청', /신청|사업계획서/, /신청·접수|온라인 신청/],
    [s.evalDate, '선정평가 (발표 · 현장평가)', /선정평가/, /평가 발표|발표·질의/],
  ];
  return L.filter((x) => x[0]).map(([due, t, re, re2]) => ({ src: '수주', taskId: tk(re2), due, t, sub: '수주 단계 · 사업 정보에서 입력한 날짜', side: 'us', done: P.length ? fin(re) : due < c.today }));
}
function afterDeadlines(c: SiteCtx): Deadline[] {
  const s = c.p;
  const we = warrantyEnd(s);
  if (!we || !s.end || c.today <= s.end || we < addDays(c.today, -30)) return [];
  const open = asIssues(c).filter((i) => i.status !== '해결').length;
  return [{ src: '사후관리', due: we, t: '하자보증 만료 — 남은 하자 · AS 정리', sub: `하자보증 ${s.warrantyM}개월 (${monthDay(s.end)}부터)${open ? ` · 처리 안 된 하자 · AS ${open}건` : ''}`, side: 'us', done: false }];
}

/** 한 사업의 기한 모음, 날짜순 — 날짜 없는 건 맨 뒤 (sumDeadlines) */
export function sumDeadlines(c: SiteCtx): Deadline[] {
  const out: Deadline[] = [];
  if (isDrop(c.p)) return out;
  out.push(...bidDeadlines(c), ...afterDeadlines(c));
  for (const g of govItems(c) ?? []) {
    const r = govRec(c, g);
    out.push({ src: g.follow ? '점검 후속' : '관리기준', id: g.id, due: g.due, inner: g.inner, t: g.t, sub: `${g.dueTxt} · ${g.who} · 세부관리기준 ${g.law}`, gov: r, chk: 'gov', res: g.res, side: g.side, pid: GOV_FOLLOW_OF[g.id], done: !!r });
  }
  for (const d of planDuties(c).filter((x) => !x.after)) {
    const r = dutyRec(c, d);
    out.push({ src: '계획서 약속', id: d.id, due: d.due, t: d.t, sub: `${d.cat} · ${d.dueTxt} · ${d.who}`, duty: r, chk: 'plan', side: dutySide(d.who), done: !!r });
  }
  const bl = c.baseline?.map ?? {};
  for (const t of siteStats(c).ms.filter((x) => !isPre(x))) {
    const base = bl[t.id]?.end ?? '';
    out.push({ src: '마일스톤', taskId: t.id, due: t.end, t: t.name, sub: `업무 ${t.code} · ${t.stage}${base && base !== t.end ? ` · 최초 계획 ${base}` : ''}`, side: 'us', done: done(c, t), shift: base && t.end ? diffDays(base, t.end) : 0 });
  }
  const k = (x: Deadline) => x.due || '9';
  return out.sort((a, b) => (k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0));
}

/** 내부 마감이 있으면 그것, 없으면 기한 (dlEff) */
export const dlEff = (x: { inner?: string; due: string }) => x.inner || x.due;

/**
 * 기한 집계 (dlStat) — 통합 사업 현황·사업 화면·알림이 모두 이 기준.
 * 지난 기한 = 완료 안 됐고 실제 기한이 지남 / 2주 안 = 안 지났고 내부 마감(없으면 기한)까지 14일 이하 /
 * 도입기업 챙길 일 = 도입기업 몫(함께 포함) 중 지났거나 내부 마감까지 14일 이하
 */
export function dlStat(c: SiteCtx, dl = sumDeadlines(c)) {
  const L = dl.filter((x) => !x.done && x.due);
  const left = (x: Deadline) => diffDays(c.today, dlEff(x));
  const buyerAll = L.filter((x) => x.side === 'buyer' || x.side === 'both');
  return {
    past: L.filter((x) => x.due < c.today),
    soon: L.filter((x) => x.due >= c.today && left(x) <= 14),
    buyer: buyerAll.filter((x) => left(x) <= 14),
    buyerAll,
  };
}

/** 남은 날 한 줄: 내부 마감이 있으면 '내부 10/25 · 15일 경과 (기한 11/1)' (dlLeft) */
export function dlLeftText(x: { inner?: string; due: string }, today: string) {
  const lt = (d: string) => { const n = diffDays(today, d); return n < 0 ? `${-n}일 경과` : n === 0 ? '오늘 마감' : `${n}일 남음`; };
  return x.inner ? `내부 ${monthDay(x.inner)} · ${lt(x.inner)} (기한 ${monthDay(x.due)})` : `${monthDay(x.due)} · ${lt(x.due)}`;
}

// ── 협약변경 ──────────────────────────────────────────

export const AGR_KINDS: ReadonlyArray<readonly [string, string, '' | '등록' | '승인']> = [
  ['ext', '구축기간 연장', ''], ['staff', '투입인력 · 업무분장 변경 (인건비 · 투입률 같음)', '등록'], ['eqS', '1,000만원 미만 장비 변경', '등록'], ['addr', '주소 · 대표자 변경', '등록'],
  ['scope', '구축 범위 · 금액 · KPI 변경', '승인'], ['eqL', '1,000만원 이상 장비 변경', '승인'], ['sup', '공급기업 변경', '승인'], ['budget', '사업비 총액 변경', '승인'], ['move', '공장 이전', '승인'],
];
/** 승인 필요 / 등록만 (agrJudge) */
export const agrJudge = (kind: string, from: string, to: string): '승인' | '등록' =>
  kind === 'ext' ? (from && to && addMonths(from, 3) <= to ? '승인' : '등록') : (AGR_KINDS.find((x) => x[0] === kind)?.[2] || '등록');
/** 업무 목록이 협약 종료일보다 늦게 끝나는지 (agrWarn) — 협약 이전·관리기준 업무 제외 */
export function agrWarn(c: SiteCtx) {
  const s = c.p;
  if (!s.end) return null;
  const ts = c.ts.filter((t) => !isPre(t) && !t.name.startsWith(GOV_TASK_TAG) && t.end);
  const last = ts.reduce<PmTask | null>((a, t) => (!a || t.end > a.end ? t : a), null);
  if (!last || last.end <= s.end) return null;
  return { end: last.end, t: last, days: diffDays(s.end, last.end), kind: addMonths(s.end, 3) <= last.end ? ('승인' as const) : ('등록' as const), over6: addMonths(s.end, 6) < last.end };
}

// ── 갱신 · 요약 ───────────────────────────────────────

/**
 * 사업 최종 갱신일 (lastUpd): 업무 목록 기준일 · 변경 이력 · 주간 점검 · 티켓 처리 중 가장 최근, 오늘을 넘지 않음.
 * 주간 점검(wcChk)은 5단계 — 그 날짜들은 `more` 로 받는다.
 */
export function lastUpdate(baseDate: string, logs: readonly PmChangeLog[], ticketDates: readonly string[], today: string, more: readonly string[] = []) {
  let d = baseDate;
  for (const x of [...logs.map((l) => l.date), ...ticketDates, ...more]) if (x > d) d = x;
  return d > today ? today : d;
}

export interface SiteBrief {
  dl: Deadline[];
  next: Deadline | undefined;
  past: Deadline[];
  soon: Deadline[];
  buyer: Deadline[];
  buyerAll: Deadline[];
  /** 보완 미조치 지적 사항 */
  fix: Array<{ itemId: string; text: string; st: string }>;
  fixWait: number;
  agr: ReturnType<typeof agrWarn>;
  /** 필수 TASK 빠짐 (정부사업 아니면 null) */
  miss: number | null;
  upd: string;
  stale: boolean;
  /** 급한 순 점수 */
  score: number;
  status: PmSiteStatus;
  stats: SiteStats;
}

/** 전체 사업 표 한 줄 = 사업별 화면 요약 (siteBrief 7423) */
export function siteBrief(c: SiteCtx, upd: string): SiteBrief {
  const dl = sumDeadlines(c);
  const cmp = (a: Deadline, b: Deadline) => (dlEff(a) < dlEff(b) ? -1 : dlEff(a) > dlEff(b) ? 1 : 0);
  const open = dl.filter((x) => !x.done && x.due);
  const next = open.filter((x) => x.due >= c.today).sort(cmp)[0];
  const st = dlStat(c, dl);
  const fix = [...c.gov.values()].flatMap((r) => r.items.map((it) => ({ itemId: r.itemId, text: it.text, st: it.st }))).filter((it) => it.st !== '확인');
  const agr = agrWarn(c);
  const wc = govWbsCheck(c);
  const miss = wc ? wc.filter((x) => x.st === 'none' || x.st === 'nodate').length : null;
  const stale = !upd || diffDays(upd, c.today) > 14;
  const stats = siteStats(c);
  const status = siteStatusFull(c, stats);
  const score = st.past.length * 10 + (agr ? (agr.kind === '승인' ? 8 : 5) : 0) + fix.length * 3 + (next && diffDays(c.today, dlEff(next)) <= 7 ? 4 : 0)
    + st.buyer.length * 2 + (stale ? 2 : 0) + (status === '지연' ? 3 : status === '소폭지연' ? 1 : 0) + (miss ?? 0);
  return { dl, next, ...st, fix, fixWait: fix.filter((x) => x.st === '조치 완료').length, agr, miss, upd, stale, score, status, stats };
}

// ── 사업 흐름 단계 ────────────────────────────────────

/** 수주 → 착수 → 구축 → 마무리 → 사후관리 (STAGES) — 협약일·관리기준 기록·종료일로 자동 판단, 입력 없음 */
export const SITE_STAGES = [
  { n: '수주', hint: '영업 · 사업계획서 신청 · 선정평가. 협약을 맺으면 착수로 넘어갑니다' },
  { n: '착수', hint: '협약 후 14일 안에 착수계 · 보증보험 제출 (도입기업이 내는 서류는 PM이 챙김)' },
  { n: '구축', hint: '개발 · 설치 진행. 협약 후 약 3개월에 중간점검' },
  { n: '마무리', hint: '종료 30일 전 최종점검 준비 → 완료보고 → 감리 → 최종평가' },
  { n: '사후관리', hint: '인수인계 · 기술임치 · 하자보수 / AS' },
] as const;

export interface SiteStage { i: number; n: string; sub: string; bad: boolean; next: Gate | null; per: string[] }

/** 사업 단계 (siteStage 7542) */
export function siteStage(c: SiteCtx): SiteStage {
  const s = c.p;
  const T = c.today;
  const G = govItems(c);
  const g = (id: string) => G?.find((x) => x.id === id);
  const isDoneG = (id: string) => { const x = g(id); return !!(x && govRec(c, x)); };
  const v = (id: string) => c.gov.get(id)?.v ?? '';
  const open = G ? G.filter((x) => !govRec(c, x)) : [];
  const nextIn = (ids: string[]) => open.find((x) => ids.includes(x.id) || (!!x.follow && ids.includes(x.follow))) ?? null;
  let i: number;
  let sub = '';
  let bad = false;
  let next: Gate | null = null;
  if (isDrop(s) || !s.start || T < s.start) {
    i = 0;
    const b = bidState(c);
    sub = b.sub; next = b.next; bad = !!b.bad;
  } else if (T < addDays(s.start, 30) && !(G && isDoneG('g_start'))) {
    i = 1;
    next = G ? g('g_start')! : { t: '착수', due: addDays(s.start, 14) };
    sub = G ? (next.due < T ? '착수계 기한 지남' : '착수계 제출 전') : '';
  } else if (G ? ['성공'].includes(v('g_reeval') || v('g_eval')) : !!s.end && T > s.end) {
    i = 4;
    next = nextIn(['g_handover']);
    const we = warrantyEnd(s);
    if (next) sub = '인수인계 · 기술임치';
    else if (we && T <= we) { sub = `하자보증 ${dday(we, T)}`; next = { t: '하자보증 만료', due: we }; }
    else sub = we ? '하자보증 끝' : '하자보수 · AS (보증 기간 미입력)';
    const oa = asIssues(c).filter((x) => x.status !== '해결').length;
    if (oa) sub += ` · 하자 · AS ${oa}건`;
  } else if (s.end && (T >= addDays(s.end, -30) || isDoneG('g_done'))) {
    i = 3;
    next = nextIn(['g_ready', 'g_done', 'g_audit', 'g_settle', 'g_eval', 'g_as', 'g_reeval']);
    const lab: Record<string, string> = { g_ready: '최종점검 준비', g_done: '완료보고', g_audit: '감리 최종점검', g_audit_fix: '감리 보완 조치', g_settle: '사업비 정산', g_eval: '최종평가', g_as: '집중AS', g_reeval: '최종재평가' };
    if (!G) { next = T <= s.end ? { t: '협약 종료', due: s.end } : null; sub = T <= s.end ? '종료 준비' : '종료 · 결과 정리'; }
    else sub = next ? lab[next.id ?? ''] || '' : '구축완료 · 결과 대기';
    bad = GOV_BAD.includes(v('g_audit')) || GOV_BAD.includes(v('g_eval')) || GOV_BAD.includes(v('g_reeval'));
    if (bad) sub = `판정: ${v('g_reeval') || v('g_eval') || v('g_audit')}`;
  } else {
    i = 2;
    const m = v('g_mid');
    if (!G) sub = '';
    else if (m === '중단') { sub = '중간점검 중단'; bad = true; }
    else if (m === '보완' && !isDoneG('g_mid_fix')) { sub = '중간점검 보완 중'; next = g('g_mid_fix') ?? null; }
    else if (m) sub = '중간점검 통과';
    else if (isDoneG('g_mid')) sub = '중간점검 완료';
    else {
      const md0 = g('g_mid');
      sub = md0 && md0.due < T ? '중간점검 확인 필요' : md0 && diffDays(T, md0.due) <= 14 ? '중간점검 준비' : '중간점검 전';
      next = md0 ?? null;
    }
    if (G && !isDoneG('g_start')) { sub = '착수계 완료 체크 안 됨'; next = g('g_start') ?? null; }
    if (!next) next = G ? open.find((x) => x.due >= T && x.id !== 'g_bond') ?? null : s.end ? { t: '협약 종료', due: s.end } : null;
  }
  if (next && next.due < T) bad = true;
  // 단계별 기간 (예상): 착수 = 협약 ~ +14일, 구축 ~ 종료 31일 전, 마무리 ~ 최종평가, 사후관리 이후
  const ev = g('g_eval');
  const pre = preSteps(c);
  const md = monthDay;
  const we = warrantyEnd(s);
  const per = s.start && s.end
    ? [pre.length && pre[0].a ? `${md(pre[0].a)}~${md(addDays(s.start, -1))}` : '', `${md(s.start)}~${md(addDays(s.start, 14))}`, `~${md(addDays(s.end, -31))}`,
      `${md(addDays(s.end, -30))}~${ev ? md(ev.due) : md(s.end)}`, `${ev ? md(ev.due) : md(s.end)}~${we ? we.slice(2).replace(/-/g, '.') : ''}`]
    : ['', '', '', '', ''];
  return { i, n: SITE_STAGES[i].n, sub, bad, next, per };
}

// ── 마일스톤 알림 · 확인 필요 ─────────────────────────

export interface MsAlert { lv: 'bad' | 'warn' | 'ok'; p: PmProject; t: PmTask; pend: number }
/** 같은 단계에서 마일스톤 종료일 전에 끝나야 하는 업무 (msReq) */
const msReq = (c: SiteCtx, t: PmTask) => c.ts.filter((x) => x.stage === t.stage && x.id !== t.id && x.end && x.end <= t.end);
/** 마일스톤 알림 (msAlerts 2402) — 2주 안·지남·완료 후 확인 필요 */
export function msAlerts(cs: readonly SiteCtx[], msOk: ReadonlyMap<string, PmMilestoneOk>): MsAlert[] {
  const out: MsAlert[] = [];
  for (const c of cs) {
    if (isDrop(c.p)) continue;
    for (const t of siteStats(c).ms.filter((x) => !isPre(x))) {
      const d = done(c, t);
      if (d && msOk.has(t.id)) continue;
      if (!t.end) continue;
      const left = diffDays(c.today, t.end);
      const pend = msReq(c, t).filter((x) => !done(c, x)).length + (d ? 0 : 1);
      if (d) { if (left <= 14) out.push({ lv: 'ok', p: c.p, t, pend }); continue; }
      if (left < 0) out.push({ lv: 'bad', p: c.p, t, pend });
      else if (left <= 14) out.push({ lv: left <= 7 ? 'bad' : 'warn', p: c.p, t, pend });
    }
  }
  const o = { bad: 0, warn: 1, ok: 2 };
  return out.sort((a, b) => o[a.lv] - o[b.lv] || (a.t.end < b.t.end ? -1 : 1));
}
/** 오래 지난 마일스톤 — 예정일이 14일 넘게 지났는데 미완료 (msOld) */
export const msOld = (c: SiteCtx, t: PmTask) => !done(c, t) && !!t.end && diffDays(t.end, c.today) > 14;

/** 기한 지난 액션 아이템 (확인 필요 카드) */
export const lateActions = (as: readonly PmAction[], today: string) => as.filter((a) => !a.done && a.due && a.due < today);

// ── 화면용: 사업 계산 묶음 만들기 ─────────────────────

export interface SiteInputs {
  tasks: readonly PmTask[];
  liveMap: ReadonlyMap<string, Live>;
  plans: Readonly<Record<string, PmPlan>>;
  gov: readonly PmGovRecord[];
  planChecks: readonly PmPlanCheck[];
  govLinks: readonly PmGovLink[];
  agreements: readonly PmAgreementChange[];
  baselines: readonly PmBaseline[];
  issues: readonly PmIssue[];
}
/** 사업 1개의 SiteCtx */
export function siteCtxOf(p: PmProject, x: SiteInputs, today: string): SiteCtx {
  const by = <T extends { projectId: string }>(a: readonly T[]) => a.filter((r) => r.projectId === p.id);
  return {
    p,
    ts: x.tasks.filter((t) => t.projectId === p.id),
    live: (t) => x.liveMap.get(t.id) ?? liveOf(t),
    today,
    plan: x.plans[p.id] ?? null,
    gov: new Map(by(x.gov).map((r) => [r.itemId, r])),
    planChk: new Map(by(x.planChecks).map((r) => [r.dutyId, r])),
    govLink: new Map(by(x.govLinks).map((r) => [r.itemId, r.taskIds])),
    agr: by(x.agreements),
    baseline: x.baselines.find((b) => b.id === p.id) ?? null,
    issues: by(x.issues),
  };
}

// ── 사업별 화면 (3-3) ─────────────────────────────────

export interface StageBucket { L: PmTask[]; n: number; p: number; late: number; on: number; od: number }
/**
 * 업무를 사업 단계에 나눔 (stageBuckets 7579) — 기준 = 업무 종료일.
 * 협약 이전 = 수주, 협약일+15일 전 = 착수, 종료 31일 전 뒤 = 마무리, 그 외(날짜 없음 포함) = 구축.
 * 산출물 제출 여부(docOf)는 4단계 산출물 화면 → 그때까지 `docDone` 없음 = 모두 미제출.
 */
export function stageBuckets(c: SiteCtx, docDone: (t: PmTask) => boolean = () => false): StageBucket[] {
  const s = c.p;
  const B: PmTask[][] = [[], [], [], [], []];
  if (isDrop(s)) return B.map(bucket);
  const a1 = s.start ? addDays(s.start, 15) : null;
  const a2 = s.end ? addDays(s.end, -31) : null;
  for (const t of c.ts) {
    const j = isPre(t) ? 0 : !t.end ? 2 : a1 && t.end < a1 ? 1 : a2 && t.end > a2 ? 3 : 2;
    B[j].push(t);
  }
  return B.map(bucket);
  function bucket(L: PmTask[]): StageBucket {
    const outs = L.filter((t) => t.output && !isPre(t));
    return {
      L, n: L.length,
      p: L.length ? Math.round(L.reduce((a, t) => a + (c.live(t).pct || 0), 0) / L.length) : 0,
      late: L.filter((t) => late(c, t)).length,
      on: outs.length,
      od: outs.filter(docDone).length,
    };
  }
}
/** 단계 주요 업무 — 안 끝난 것, 늦은 일 · 마일스톤 · 마감 가까운 순 (flowCard key) */
export function stageKeyTasks(c: SiteCtx, b: StageBucket): PmTask[] {
  const L = b.L.filter((t) => !done(c, t));
  return L.sort((a, b2) => {
    const la = late(c, a) ? 1 : 0;
    const lb = late(c, b2) ? 1 : 0;
    return lb - la || (b2.milestone ? 1 : 0) - (a.milestone ? 1 : 0) || ((a.end || '9') < (b2.end || '9') ? -1 : 1);
  });
}

// 계획서 약속 기능 ↔ 업무 자동 연결 (fnLinks 7052)
/** 띄어쓰기 · 괄호 · 끝의 관리/현황/조회/등록을 뺌 (fnNorm) */
const fnNorm = (s: string) => String(s || '').replace(/\s|\(.*?\)|관리$|현황$|조회$|등록$/g, '');
const fnBig = (s: string) => { const x = fnNorm(s); const r = new Set<string>(); for (let i = 0; i < x.length - 1; i++) r.add(x.slice(i, i + 2)); return r; };
/** 이름 비슷한 정도 — 두 글자 묶음이 겹치는 비율 (fnSim) */
export function fnSim(a: string, b: string) {
  const A = fnBig(a);
  const B = fnBig(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  A.forEach((x) => { if (B.has(x)) n++; });
  return (2 * n) / (A.size + B.size);
}
export type FnKind = '추가' | '변경' | '기존' | string;
export interface FnLink { mod: string; name: string; kind: FnKind; t: PmTask | null }
/**
 * 계획서 기능 → 업무 자동 연결 (fnLinks). 대상 업무 = 번호가 '5.16.1'처럼 세 단계 이상인 단위 기능 업무 ([FP]·협약 이전 제외).
 * 기존(패키지) 기능은 개발 대상이 아니라 연결 안 함. 비슷한 정도 0.5 이상만. 계획서 기능 목록이 없으면 null.
 */
export function fnLinks(c: SiteCtx, list: ReadonlyArray<readonly [string, string, string]> | undefined): FnLink[] | null {
  if (!list) return null;
  const ts = c.ts.filter((t) => /^\d+\.\d+\.\d+/.test(t.code) && !isFP(t) && !isPre(t));
  return list.map(([mod, name, kind]) => {
    let best: PmTask | null = null;
    let b = 0;
    if (kind !== '기존') for (const t of ts) { const v = Math.max(fnSim(name, t.name), fnSim(mod + name, t.name)); if (v > b) { b = v; best = t; } }
    return { mod, name, kind, t: b >= 0.5 ? best : null };
  });
}
export type FnState = '완료' | '지연' | '진행 중' | '시작 전' | '연결 없음' | '기존';
/** 기능 상태 (fnSt) */
export const fnSt = (c: SiteCtx, f: FnLink): FnState =>
  !f.t ? (f.kind === '기존' ? '기존' : '연결 없음') : done(c, f.t) ? '완료' : late(c, f.t) ? '지연' : c.live(f.t).pct > 0 || nowOf(c, f.t) ? '진행 중' : '시작 전';

/** 최근 업데이트 (siteUpdates 7338) — 점검 결과 · 협약변경. 주간 특이사항은 5단계(주간 점검)에서 더함 */
export interface SiteUpdate { d: string; tag: '주간 특이사항' | '점검 결과' | '협약변경'; who: string; txt: string; res?: string }
export function siteUpdates(c: SiteCtx): SiteUpdate[] {
  const out: SiteUpdate[] = [];
  for (const g of govItems(c) ?? []) {
    const r = c.gov.get(g.id);
    if (r && r.v) out.push({ d: r.date, tag: '점검 결과', who: r.by, txt: `${g.t.replace(/ —.*$/, '')} — ${r.v}${r.memo ? ` · ${r.memo}` : ''}`, res: r.v });
  }
  for (const x of c.agr) out.push({ d: x.date, tag: '협약변경', who: x.by, txt: `${AGR_KINDS.find((y) => y[0] === x.kind)?.[1] ?? ''}${x.to ? ` → ${x.to}` : ''} · ${x.st}${x.text ? ` · ${x.text}` : ''}` });
  return out.sort((a, b) => (a.d < b.d ? 1 : -1));
}

/** 점검 결과 팝업 안내 (GOV_HINT) */
export const GOV_HINT: Record<string, string> = {
  g_mid: '보완 → 위 기한으로 수정 중간보고서 · 재점검 할 일이 기한 목록에 생깁니다',
  g_audit: '보완 → 위 기한으로 시정조치 할 일이 생깁니다',
  g_audit_fix: '판정일 기준으로 최종평가 예정일이 바뀝니다',
  g_eval: '성공 → 7일 안에 인수인계서 · 기술임치 제출 기한 / 보완 → 집중AS · 최종재평가(집중AS 종료 + 14일) 기한이 생깁니다',
  g_reeval: '성공 → 7일 안에 인수인계서 · 기술임치 제출 기한이 생깁니다',
};
/** 보완일 때 직접 정하는 후속 기한: [칸 이름, 기본값, 설명] (GOV_FIX) */
export const GOV_FIX: Record<string, readonly [string, ((p: PmProject) => string) | null, string]> = {
  g_mid: ['보완 기한 (수정 중간보고서 제출)', null, '통보 공문에 적힌 기한을 넣으세요 (규정상 최대 30일, 29조)'],
  g_audit: ['시정조치 기한 (시정조치결과서 제출)', null, '통보 공문에 적힌 기한을 넣으세요 (규정상 최대 30일, 31조⑥)'],
  g_eval: ['집중AS 종료일', (p) => (p.end ? addMonths(p.end, 6) : ''), '기본값은 구축완료일 + 6개월 (33조)'],
};
/** 판정 꼬리표 색 (govResCls) */
export const govResTone = (v: string): 'ok' | 'warn' | 'bad' => (GOV_BAD.includes(v) ? 'bad' : v === '보완' ? 'warn' : 'ok');

export const AGR_DOC = { 승인: '협약변경 승인 필요 — 변경신청서 + 도입 · 공급기업 서명 회의록 + 수정사업계획서 (협약변경위원회)', 등록: '사업관리시스템에 즉시 등록' } as const;
/** 협약변경 입력 확인 (agrForm validate) — 문제 있으면 [글, 칸] */
export function agrCheck(v: { kind: string; to: string; why: string; date: string }, from: string): [string, string] | null {
  if (!v.date) return ['기록일을 넣어 주세요', 'date'];
  if (!v.why.trim()) return ['사유를 적어 주세요', 'why'];
  if (v.kind === 'ext') {
    if (!v.to) return ['새 협약 종료일을 넣어 주세요', 'to'];
    if (v.to <= from) return [`새 종료일은 지금 종료일(${from}) 이후여야 합니다`, 'to'];
    if (addMonths(from, 6) < v.to) return ['구축기간은 최대 6개월까지만 연장할 수 있습니다 (세부관리기준 24조)', 'to'];
  }
  return null;
}
