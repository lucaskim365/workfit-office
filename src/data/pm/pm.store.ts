import { addDays, applyProgress, diffDays as diffDaysLocal, makeBaseline, todayStr } from '@/domain/pm/rules';
import type {
  PmAction, PmAgreementChange, PmBaseline, PmChangeLog, PmChangeRequest, PmDoc, PmMeeting, PmReport, PmGovLink, PmCode, PmOrg, PmStdTask, PmTemplate, PmGovRecord, PmIssue, PmLater, PmMilestoneOk, PmPlanCheck,
  PmPdfDraft, PmPlanDay, PmPlanItem, PmPlanRep, PmProject, PmSubtask, PmTask, PmTaskDone, PmTaskFunctions, PmUpdRequest, PmWeekCheck,
} from '@/domain/pm/schema';
import { wdOf } from '@/domain/pm/plan';
import { pmTaskSchema } from '@/domain/pm/schema';
import type { PmPlan } from '@/domain/pm/site';
import { LOAD_MAX_DEFAULT } from '@/domain/pm/team';
import { SEED_BASE_DATE, SEED_VERSION, seedFunctions, seedItems, seedPlanFunctions, seedPlans, seedProjects, seedSubtasks, seedTasks } from './seed';
import { defaultMoneyCfg, pmFundRuleSchema, pmItemSchema, pmMoneyCfgSchema, seedFundRules, type PmFundRule, type PmItem, type PmMoneyCfg } from '@/domain/pm/money';
import { fundOf, lineToItem, paysFromTerms, pmContractSchema, pmFundSchema, pmPaySchema, qHist, qLines, qOv, quoteCheck, seedMoney, type FundCtx, type PmContract, type PmFund, type PmPay, type PmQuoteItem, type QuoteDraft } from '@/domain/pm/quote';
import { pmCostSchema, pmOhSchema, type PmCost, type PmOh } from '@/domain/pm/pl';
import { moveTicket, nextTicketNo, setTicketProg, syncTicketWithTask, tkOpen, type PmTicket } from '@/domain/pm/ticket';
import { weekStart } from '@/domain/pm/site';
import type { PmAiMeas, PmKpiDef, PmKpiMeas } from '@/domain/pm/kpi';
import { nextCrId } from '@/domain/pm/cr';
import { nextIssueId } from '@/domain/pm/issue';
import { ORG_FIELD, baseTplTasks, deriveMaster, makeTasks, projectNo, stdTplTasks, type Master } from '@/domain/pm/master';
import { codeDelBlock, nextCodeIn as nextCode, orgUse, stdOf } from '@/domain/pm/masterLink';
import { PM_COLLS, type PmDb } from './pmDb';
import { createPmSync, PmConflictError, PmNumberTakenError, PmPartialError, PmProjectTakenError, PmStaleWindowError, type PmProgress } from './pmSync';


/**
 * PM 저장소 — 저장 함수 90개(`core`)가 메모리 `state` 위에서 계산한다.
 * - 메모리 모드(기본): 새로 고침하면 데모 내장 데이터로 돌아간다.
 * - DB 모드(`opts.db`, 7-2): 같은 계산을 사본 위에서 하고, 저장 계층(`pmSync`)이 바뀐 문서만 pm* 컬렉션에 쓴 뒤 바꿔 끼운다 (설계 5.7.2).
 *   화면이 쓰는 하나는 `pmStoreInstance.ts` 가 `VITE_PM_DRIVER` 로 고른다 (5.7.4).
 *
 * 격리 (§3.2.1): 이 파일은 `pm*` 데이터만 가진다. 다른 그룹웨어 repo를 부르지 않는다.
 */

export interface PmSnapshot {
  projects: PmProject[];
  tasks: PmTask[];
  functions: PmTaskFunctions[];
  subtasks: PmSubtask[];
  baselines: PmBaseline[];
  logs: PmChangeLog[];
  done: PmTaskDone[];
  /** 티켓 (2단계) — 메모리. 옛 티켓(state.json)은 7단계 옮기기 때 들어옴 */
  tickets: PmTicket[];
  /** 데이터 출처 표시 (데모 ver) */
  sourceVersion: string;
  /** 업무 목록 엑셀 갱신일 (데모 base) — 사업 '갱신 n일 전'의 바탕 */
  baseDate: string;
  /** 지금까지 쓴 가장 큰 사업 번호 (결정 (가) 11/26 팀장, 데모와 다름) — 사업을 지워도 그 번호를 다시 안 씀. 사업 삭제 때 갱신 */
  lastProjectNo: number;
  // ── 3단계 (사업 현황) ──
  /** 사업계획서 내장 데이터 (사업 ID → 계획서) */
  plans: Record<string, PmPlan>;
  /** 계획서 기능 목록 (사업 ID → [메뉴, 기능, 구분]) */
  planFunctions: Record<string, Array<[string, string, string]>>;
  gov: PmGovRecord[];
  planChecks: PmPlanCheck[];
  govLinks: PmGovLink[];
  agreements: PmAgreementChange[];
  msOk: PmMilestoneOk[];
  /** 이슈·액션 — 화면은 5단계, 지금은 대시보드가 세기만 (0건) */
  issues: PmIssue[];
  actions: PmAction[];
  // ── 3-4 (팀 현황) ──
  /** 화면 설정 (데모 S.loadMax — 모두가 같이 보는 값) */
  settings: { loadMax: number; carryFrom: string };
  // ── 3-5 (내 업무) ──
  /** 진행률 '변동 없음' 확인 (주마다) */
  weekChecks: PmWeekCheck[];
  /** 나중에 할 일 (사람마다) */
  later: PmLater[];
  /** 진행률 갱신 요청 (보내는 화면은 5단계 주간 진행률) */
  updReq: PmUpdRequest[];
  // ── 3-6 (업무계획) ──
  /** 직접 고친 날의 계획 (사람 · 날짜마다) */
  planDays: PmPlanDay[];
  /** 반복 업무 (사람마다) */
  planReps: PmPlanRep[];
  /** 일일 업무 보고 임시저장 (사람 · 날짜마다, 30일) */
  pdfDrafts: PmPdfDraft[];
  // ── 3-7 ──
  /** 직접 등록한 성과지표 · 실측 기록 · AI 성능 측정 (데모 S.kpiDefs · kpiMeas · aiMeas) */
  kpiDefs: PmKpiDef[];
  kpiMeas: PmKpiMeas[];
  aiMeas: PmAiMeas[];
  /** 🔔 확인한 알림 (사람 → 알림 문구 → 확인한 날, 데모 S.seen). 문구가 바뀌면 새 알림 */
  seen: Array<{ id: string; items: Record<string, string> }>;
  /** ☆ 즐겨찾기 (사람마다, 데모 S.fav) — v = 보기 id, k = 사업별 화면에서 고른 사업 */
  favs: Array<{ id: string; items: Array<{ v: string; k: string }> }>;
  // ── 4단계 (점검 · 요구사항 · 산출물) ──
  /** 산출물 제출 상태 (데모 S.docs) — 사람이 고르거나 파일을 올린 업무만 */
  docs: PmDoc[];
  /** 요구사항 변경 (데모 S.crs) — 최근 접수가 앞 */
  crs: PmChangeRequest[];
  // ── 5단계 ──
  /** 회의록 (데모 S.meetings) */
  meetings: PmMeeting[];
  /** 주간 보고 작성 항목 (데모 S.reports) */
  reports: PmReport[];
  // ── 6단계: 기준정보 (데모 S.orgs · S.codes · S.templates) ──
  orgs: PmOrg[];
  codes: PmCode[];
  stdTasks: PmStdTask[];
  templates: PmTemplate[];
  /** 사업 업무 ↔ 표준 세부 업무 직접 연결 (데모 S.tlink, id = 업무 ID) */
  tlinks: Array<{ id: string; stdId: string }>;
  // ── 6-4: 사업 · 손익 기준정보 (데모 S.money.cfg · rules · items) — 화면은 pm.manage 만 ──
  moneyCfg: PmMoneyCfg;
  fundRules: PmFundRule[];
  items: PmItem[];
  // ── 6-5: 견적 · 계약 · 재원 · 대금 (데모 S.money.contracts · fund · pays) — 화면은 pm.manage 만. 사업별 수익 · 손익 화면은 6-6 ──
  contracts: PmContract[];
  funds: PmFund[];
  pays: PmPay[];
  // ── 6-6: 원가 변경 · 간접비 (데모 S.money.costs · oh) ──
  costs: PmCost[];
  oh: PmOh[];
}

const clone = <T>(v: T): T => structuredClone(v);
let seq = 0;
/** 새 id — 시각 + 순번 + 무작위 4글자 (두 사람이 같은 순간에 만들어도 안 겹치게, 5.7.2) */
const defaultNid = (p: string) => `${p}${Date.now().toString(36)}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6).padEnd(4, '0')}`;

export interface PmStoreOpts {
  /** DB 모드 (설계 5.7.2) — 없으면 메모리 */
  db?: PmDb;
  /** 켜면 안 되는 상태 (스위치 가드 5.7.4) — 모든 읽기 · 저장이 이 글로 멈춤 */
  blocked?: string;
  /** 테스트: id 만들기를 정해진 순서로 */
  nid?: (p: string) => string;
}
/** 저장 함수가 아닌 것 (테스트 ⓐ 가 '한 번도 안 부른 저장 함수'를 셀 때 뺌) */
export const PM_READ_METHODS = ['snapshot', 'refresh', 'peek', 'gen', 'notices', 'onProgress', 'fundOf', 'withBase'] as const;

const MSG = {
  partial: '저장 중 연결이 끊겨 일부만 저장됐습니다. 화면은 저장된 상태로 다시 읽었습니다 — 다시 저장하지 말고 창을 닫아 목록에서 확인해 주세요 (사업 등록이면 [삭제]로 지운 뒤 다시 등록)',
  failed: '저장하지 못했습니다 (DB 연결 오류). 확인 후 다시 저장해 주세요',
  empty: 'PM 저장소가 비어 있어 저장할 수 없습니다 (데이터 옮기기 전)',
  number: '번호가 겹쳐 3번 다시 했지만 저장하지 못했습니다. 잠시 뒤 다시 저장해 주세요',
  project: (id: string) => `사업키 ${id} 는 다른 사람이 방금 먼저 등록했습니다. 다시 읽었으니 다른 사업키로 등록해 주세요`,
};

/**
 * DB 모드 저장 실패 (충돌 · 일부만 저장 · 연결 오류 · 번호 · 사업키 · 빈 저장소) — 화면이 공통 안내를 띄우는 표시 (7-6).
 * 메모리 모드의 입력 검사 오류(이미 쓰는 번호 등)는 이 종류가 아님 → 화면 동작 그대로.
 */
export class PmDbSaveError extends Error {
  constructor(msg: string, public readonly partial = false) { super(msg); this.name = 'PmDbSaveError'; }
}
export const isPmDbSaveError = (e: unknown): e is Error => e instanceof PmDbSaveError || e instanceof PmConflictError;
export const isPmPartialSave = (e: unknown) => e instanceof PmDbSaveError && e.partial;

/**
 * 기준표 (F5, 설계 5.7.17) — 수정 창이 **폼 처음 값을 복사한 그 기록**을 열 때 담아 두고, 저장 때 같이 넘긴다.
 * DB 모드 저장소는 계산 전에 지금 기록과 비교해 다르면(남이 고침 · 지움 · 새로 만듦) 아무것도 안 쓰고 PmStaleWindowError.
 * 저장이 다 끝나면 저장소가 표의 기록을 새 기록으로 바꿈 → 같은 창에서 잇달아 저장해도 안 막힘 (M7: 실패 · 일부만 저장이면 그대로).
 * 메모리 모드는 표를 안 봄.
 */
export interface PmBase {
  field: keyof PmSnapshot;
  /** 기록 id (티켓은 no). 하나짜리 칸(moneyCfg)은 없음 */
  id?: string;
  /** 비교할 칸만 (없으면 기록 전체) */
  keys?: readonly string[];
  /** 창이 연 때 기록 — 그때 없던 기록이면 null */
  rec: unknown;
}
export type PmBases = PmBase[];
/** 창이 연 때 기록으로 기준표 한 줄 (기록은 복사해 둠 — 창이 나중에 고쳐도 안 바뀜) */
export const pmBase = (field: keyof PmSnapshot, id: string | undefined, rec: unknown, keys?: readonly string[]): PmBase =>
  ({ field, ...(id === undefined ? {} : { id }), ...(keys ? { keys } : {}), rec: rec == null ? null : structuredClone(rec) });

const SCHEMA_OF = new Map(PM_COLLS.flatMap((c) => c.kinds).filter((k) => k.schema).map((k) => [k.field as string, k.schema!]));
/** 지금 상태의 그 기록 (없으면 null) */
export function baseCur(s: PmSnapshot, b: PmBase): unknown {
  const v = (s as unknown as Record<string, unknown>)[b.field];
  if (!Array.isArray(v)) return v ?? null;
  if (b.id === undefined) return v;
  const idOf = (r: Record<string, unknown>) => String(b.field === 'tickets' ? r.no : r.id);
  return (v as Array<Record<string, unknown>>).find((r) => idOf(r) === b.id) ?? null;
}
/** 비교용 글자 — DB 에서 읽은 기록과 같은 모양으로(칸 스키마로 다시 읽음 · 빈 칸 기본값), 안쪽 칸 순서까지 맞춰 (M5: 빈 칸 · 칸 순서로 잘못 막지 않게) */
function baseText(field: string, rec: unknown, keys?: readonly string[]): string {
  let v = rec;
  const sc = SCHEMA_OF.get(field);
  if (v && typeof v === 'object' && !Array.isArray(v) && sc) { const p = sc.safeParse(v); if (p.success) v = p.data; }
  if (v && keys) { const o = v as Record<string, unknown>; v = Object.fromEntries(keys.map((k) => [k, o[k] ?? null])); }
  return JSON.stringify(sortDeep(v ?? null));
}
function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (!v || typeof v !== 'object') return v;
  const o = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) if (o[k] !== undefined) out[k] = sortDeep(o[k]);
  return out;
}
/** 표의 기록 = 지금 기록 (있고 없음 포함, M3) */
export const baseSame = (s: PmSnapshot, b: PmBase) => baseText(b.field, b.rec, b.keys) === baseText(b.field, baseCur(s, b), b.keys);

/** DB 모드 처음 상태 — 계획서 내장 데이터 · 기본 설정만 (처음 값(내장 데이터)은 메모리 모드 전용, 5.7.4) */
function emptyState(): PmSnapshot {
  return {
    projects: [], tasks: [], functions: [], subtasks: [], baselines: [], logs: [], done: [], tickets: [], sourceVersion: '', baseDate: '', lastProjectNo: 0,
    plans: seedPlans(), planFunctions: seedPlanFunctions(), gov: [], planChecks: [], govLinks: [], agreements: [], msOk: [], issues: [], actions: [],
    settings: { loadMax: LOAD_MAX_DEFAULT, carryFrom: '' }, weekChecks: [], later: [], updReq: [], planDays: [], planReps: [], pdfDrafts: [],
    kpiDefs: [], kpiMeas: [], aiMeas: [], seen: [], favs: [], docs: [], crs: [], meetings: [], reports: [],
    orgs: [], codes: [], stdTasks: [], templates: [], tlinks: [], moneyCfg: defaultMoneyCfg(), fundRules: [], items: [],
    contracts: [], funds: [], pays: [], costs: [], oh: [],
  };
}

/** 칸 이름 (변경 이력용) */
const FIELD_LABEL: Partial<Record<keyof PmTask, string>> = {
  name: '업무명', output: '산출물', stage: '단계', group: '묶음', code: '번호', start: '시작', end: '종료',
  status: '상태', actualPct: '실적', planPct: '계획', md: '공수', milestone: '마일스톤', assigneeIds: '담당',
  subAssigneeIds: '담당 정/부', execMemo: '실행 주체', pmName: 'PM', memo: '할 일', predecessorIds: '선행',
};
const show = (v: unknown) => (Array.isArray(v) ? v.join(', ') || '없음' : v === '' || v == null ? '없음' : String(v));

/** 바뀐 칸 → "업무명 A → B, 종료 없음 → 2026-12-01" (wbsDiff) */
export function diffText(a: PmTask, b: PmTask, nameOf: (id: string) => string = (x) => x): string {
  const out: string[] = [];
  for (const k of Object.keys(FIELD_LABEL) as (keyof PmTask)[]) {
    const x = a[k];
    const y = b[k];
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    const conv = (v: unknown) => (k === 'assigneeIds' || k === 'subAssigneeIds' ? (v as string[]).map(nameOf) : v);
    const unit = k === 'actualPct' || k === 'planPct' ? '%' : '';
    out.push(`${FIELD_LABEL[k]} ${show(conv(x))}${unit} → ${show(conv(y))}${unit}`);
  }
  return out.join(', ');
}

/** 메모리 모드 처음 상태 — 데모 내장 데이터 (7-5 에서 DB 처음 값으로도 넣음) */
function seedState(today: string): PmSnapshot {
  const projects = seedProjects();
  const tasks = seedTasks();
  const functions = seedFunctions();
  const taskIds = new Set(tasks.map((t) => t.id));
  const subtasks = seedSubtasks(functions.filter((f) => taskIds.has(f.id)), today);
  // 기준선: 없으면 켜질 때 "최초 계획"을 만든다 (initState 2159) → 일정 변동 0건이 정상 (§4.1)
  const label = `최초 계획 (${SEED_VERSION.replace(/ (수정본)$/, '')})`;
  const baselines = projects
    .map((p) => ({ p, ts: tasks.filter((t) => t.projectId === p.id) }))
    .filter((x) => x.ts.length)
    .map(({ p, ts }) => makeBaseline(p.id, ts, label, today, ''));
  return { projects, tasks, functions, subtasks, baselines, logs: [], done: [], tickets: [], sourceVersion: SEED_VERSION, lastProjectNo: 0,
    baseDate: SEED_BASE_DATE, plans: seedPlans(), planFunctions: seedPlanFunctions(),
    gov: [], planChecks: [], govLinks: [], agreements: [], msOk: [], issues: [], actions: [],
    settings: { loadMax: LOAD_MAX_DEFAULT, carryFrom: '' },
    weekChecks: [], later: [], updReq: [],
    planDays: [], planReps: [], pdfDrafts: [],
    kpiDefs: [], kpiMeas: [], aiMeas: [], seen: [], favs: [],
    docs: [],
    crs: [],
    meetings: [],
    reports: [],
    orgs: [], codes: [], stdTasks: [], templates: [], tlinks: [],
    moneyCfg: defaultMoneyCfg(), fundRules: seedFundRules(), items: seedItems(),
    // 처음 값: 신광 계약 2건 · 효광(제조AI) 최종 견적 (데모 moneySeed · moneySeed2)
    ...seedMoney(projects),
    costs: [], oh: [],
  };
}

export function createPmStore(today = todayStr(), opts: PmStoreOpts = {}) {
  const dbMode = !!(opts.db || opts.blocked);
  const nid = opts.nid ?? defaultNid;
  /** 지금 상태. DB 모드 저장은 사본 위에서 계산한 뒤 다 쓰면 바꿔 끼움 (그래서 let) */
  let state: PmSnapshot = dbMode ? emptyState() : seedState(today);
  /** 끊긴 번호 바꾸기 (새 번호 → 옛 번호, DB 모드만) — 같은 새 번호로 다시 저장하면 이어서 마침 (5.7.2) */
  let rekeyMarks = new Map<string, string>();
  /** 이번 저장에서 바꾼 업무 번호 [옛, 새] — 저장 계층이 새 업무에 rekeyFrom 표시를 붙임 */
  let rekeyed: Array<[string, string]> = [];
  /** 사업비 계산에 쓰는 값 (fundOf) */
  const fundCtx = (day: string): FundCtx => ({ projects: state.projects, plans: state.plans, rules: state.fundRules, cfg: state.moneyCfg, contracts: state.contracts, funds: state.funds, today: day });

  /** 기준정보를 사업 · 업무 목록에 맞춤 (ensureMaster) — 새 이름만 더함. 표준 세부 업무는 처음 한 번만 */
  let stdSeeded = false;
  const syncMaster = () => {
    const cur: Master = { orgs: state.orgs, codes: state.codes, stdTasks: state.stdTasks, templates: state.templates };
    const { m } = deriveMaster(cur, state.projects, state.tasks, stdSeeded);
    stdSeeded = true;
    Object.assign(state, m);
  };
  if (!dbMode) syncMaster();

  const log = (projectId: string, code: string, kind: PmChangeLog['kind'], text: string, by: string, day: string) => {
    state.logs.push({ id: nid('lg'), projectId, code, kind, text, date: day, by });
  };
  const findTask = (id: string) => {
    const i = state.tasks.findIndex((t) => t.id === id);
    if (i < 0) throw new Error('업무를 찾을 수 없습니다');
    return i;
  };
  /** 번호가 바뀌면 그 번호로 저장한 것도 따라가게 (rekey) */
  const rekey = (oldId: string, newId: string) => {
    if (oldId === newId) return;
    if (dbMode) rekeyed.push([oldId, newId]);
    // 새 번호로 이미 있는 표시 · 세부 기능은 버리고 옛 것을 옮김 — 끊긴 번호 바꾸기를 이어 할 때 먼저 옮겨 둔 사본 (5.7.2),
    // 그 밖엔 지워진 업무가 남긴 것이라 새 업무에 붙으면 안 됨
    state.functions = state.functions.filter((f) => f.id !== newId);
    state.done = state.done.filter((d) => d.id !== newId);
    state.docs = state.docs.filter((d) => d.id !== newId);
    state.msOk = state.msOk.filter((m) => m.id !== newId);
    state.tlinks = state.tlinks.filter((l) => l.id !== newId);
    for (const s of state.subtasks) if (s.taskId === oldId) s.taskId = newId;
    for (const f of state.functions) if (f.id === oldId) f.id = newId;
    for (const d of state.done) if (d.id === oldId) d.id = newId;
    for (const b of state.baselines) if (b.map[oldId]) { b.map[newId] = b.map[oldId]; delete b.map[oldId]; }
    for (const t of state.tasks) t.predecessorIds = t.predecessorIds.map((x) => (x === oldId ? newId : x));
    // 세부 작업 티켓도 새 번호로 (업무 티켓은 syncTickets 가 이력과 함께)
    for (const x of state.tickets) if (x.subtaskId && x.taskId === oldId) x.taskId = newId;
    // 업무계획 줄도 새 번호로 (rekey 2193)
    for (const p of state.planDays) for (const it of p.items) if (it.taskId === oldId) it.taskId = newId;
    // 산출물 상태 · 마일스톤 승인도 새 번호로 (rekey 2190: S.docs · S.msOk)
    for (const d of state.docs) if (d.id === oldId) d.id = newId;
    for (const m of state.msOk) if (m.id === oldId) m.id = newId;
    for (const i of state.issues) if (i.taskId === oldId) i.taskId = newId;
    for (const l of state.tlinks) if (l.id === oldId) l.id = newId;
    // CR 에 연결한 업무도 (데모 wbsKey 는 rekey 대상이 아니지만, 여기선 업무 ID 로 이어 두므로 따라가게)
    for (const c of state.crs) if (c.taskId === oldId) c.taskId = newId;
  };
  const planOf = (who: string, date: string) => state.planDays.find((p) => p.who === who && p.date === date);
  /** 업무를 고치면 업무 티켓도 따라감 (wbsSyncTicket) → 변경 이력 꼬리 " · 티켓 P2-0001 반영" */
  const syncTickets = (old: PmTask, next: PmTask, by: string, day: string) => {
    const i = state.tickets.findIndex((x) => x.taskId === old.id && !x.subtaskId && x.status !== '취소' && !x.legacyKey);
    if (i < 0) return '';
    const n = syncTicketWithTask(state.tickets[i], old, next, by, day);
    if (!n) return '';
    state.tickets[i] = n;
    return ` · 티켓 ${n.no} 반영`;
  };
  const findTicket = (no: string) => {
    const i = state.tickets.findIndex((x) => x.no === no);
    if (i < 0) throw new Error('티켓을 찾을 수 없습니다');
    return i;
  };
  /** 번호 붙여 넣기 — 사업별 다음 번호 */
  const pushTicket = (x: PmTicket) => {
    const t = { ...clone(x), no: nextTicketNo(state.tickets, x.projectId) };
    state.tickets.push(t);
    return t;
  };
  /** 세부 작업 티켓을 고치면 세부 작업도 (담당·마감·완료) */
  const syncSub = (x: PmTicket, day: string, by: string, done: boolean | null) => {
    if (!x.subtaskId) return;
    const s = state.subtasks.find((v) => v.id === x.subtaskId);
    if (!s) return;
    s.assigneeId = x.assigneeId;
    s.due = x.due;
    if (done === true) { s.done = true; s.doneDate = day; s.doneBy = by; }
    else if (done === false) { s.done = false; s.doneDate = ''; s.doneBy = ''; }
  };

  /** 새 업무 순서 값 = 지금 가장 큰 값 + 1 (업무를 지운 뒤에도 끝에 붙게 — DB 는 order 로 다시 정렬, 5.7.1) */
  const nextOrder = () => state.tasks.reduce((a, t) => Math.max(a, t.order), -1) + 1;

  const core = {
    /** 업무 추가 (wbsNew·wbsCopy) — 같은 사업·단계의 마지막 뒤에 넣음. 순서 값은 앞뒤 업무 사이 (그 업무 1건만 씀, 5.7.1) */
    async addTask(t: PmTask, by: string, day = todayStr()): Promise<PmTask> {
      if (state.tasks.some((x) => x.id === t.id)) throw new Error(`이미 ${t.code} 번호가 있습니다`);
      let at = -1;
      state.tasks.forEach((x, i) => { if (x.projectId === t.projectId && (x.group || x.stage) === (t.group || t.stage)) at = i; });
      if (at < 0) state.tasks.forEach((x, i) => { if (x.projectId === t.projectId) at = i; });
      const pos = at < 0 ? state.tasks.length : at + 1;
      const between = () => {
        const a = state.tasks[pos - 1]?.order;
        const b = state.tasks[pos]?.order;
        return a == null ? (b == null ? 0 : b - 1) : b == null ? a + 1 : (a + b) / 2;
      };
      let order = between();
      // 사이 값이 더 안 나뉘면(같은 자리에 수십 번 끼움) 순서를 0, 1, 2 … 로 다시 매김 — 드묾, 그때만 여러 건 씀
      if (pos > 0 && pos < state.tasks.length && !(state.tasks[pos - 1].order < order && order < state.tasks[pos].order)) {
        state.tasks.forEach((x, i) => { x.order = i; });
        order = between();
      }
      const nt = { ...clone(t), order };
      state.tasks.splice(pos, 0, nt);
      log(t.projectId, t.code, '추가', t.name, by, day);
      return clone(nt);
    },

    /** 업무 수정 (wbsEdit) — 바뀐 칸을 변경 이력에 */
    async updateTask(id: string, next: PmTask, by: string, nameOf?: (id: string) => string, day = todayStr()): Promise<PmTask> {
      // 끊긴 번호 바꾸기를 같은 새 번호로 다시 저장 = 이어서 마침 ('이미 쓰는 번호' 막음 건너뜀, 먼저 만든 새 번호 업무는 이 저장으로 바꿈 — 5.7.2)
      if (next.id !== id && rekeyMarks.get(next.id) === id) state.tasks = state.tasks.filter((x) => x.id !== next.id);
      const i = findTask(id);
      const old = state.tasks[i];
      if (next.id !== id && state.tasks.some((x) => x.id === next.id)) throw new Error(`이미 ${next.code} 번호가 있습니다`);
      state.tasks[i] = clone(next);
      rekey(id, next.id);
      const tk = syncTickets(old, next, by, day);
      log(next.projectId, next.code, '수정', `${diffText(old, next, nameOf) || '변경 없음'}${tk}`, by, day);
      return clone(next);
    },

    /** 일괄 수정 (wbsBulk) — 화면이 고친 업무들 + 업무별 바뀐 내용 요약 */
    async bulkUpdate(items: ReadonlyArray<{ next: PmTask; summary: string }>, by: string, day = todayStr()) {
      for (const { next, summary } of items) {
        const i = findTask(next.id);
        const old = state.tasks[i];
        state.tasks[i] = clone(next);
        const tk = syncTickets(old, next, by, day);
        if (summary) log(next.projectId, next.code, '수정', `일괄 수정: ${summary}${tk}`, by, day);
      }
    },

    /** 진행률 기록 · TASK 전체 완료 · 완료 취소 (quickAp) */
    async setProgress(id: string, pct: number, why: string, by: string, day = todayStr()) {
      const i = findTask(id);
      const t = state.tasks[i];
      const r = applyProgress(t, pct, day, by);
      state.tasks[i] = { ...t, actualPct: r.pct, status: r.status };
      // r.done: 새 완료 기록 / 'remove' 지움 / null 그대로 (이미 100에서 다시 100)
      if (r.done === 'remove') state.done = state.done.filter((d) => d.id !== id);
      else if (r.done) state.done = [...state.done.filter((d) => d.id !== id), r.done];
      log(t.projectId, t.code, '수정', `${r.log} (${why})`, by, day);
      // 진행 중인 업무 티켓도 같은 진행률로 (quickAp 2289: tk.prog = ap)
      const k = state.tickets.findIndex((x) => x.taskId === id && !x.subtaskId && !x.legacyKey && tkOpen(x));
      if (k >= 0 && state.tickets[k].prog !== r.pct) state.tickets[k] = setTicketProg(state.tickets[k], r.pct, by, day);
    },

    // ── 내 업무 (3-5) ──────────────────────────────────
    /** 나중에 할 일로 내리기 · 지금 할 일로 올리기 (setLater) */
    async setLater(who: string, taskId: string, on: boolean) {
      const cur = state.later.find((x) => x.id === who);
      const ids = (cur?.taskIds ?? []).filter((x) => x !== taskId);
      if (on) ids.push(taskId);
      state.later = [...state.later.filter((x) => x.id !== who), { id: who, taskIds: ids }];
    },
    /** 진행률 '변동 없음' — 이번 주에 갱신한 것으로 침 (wcMark) */
    async markNoChange(taskIds: readonly string[], by: string, day = todayStr()) {
      const week = weekStart(day);
      for (const taskId of taskIds) {
        const t = state.tasks.find((x) => x.id === taskId);
        if (!t) continue;
        const id = `${week}|${taskId}`;
        state.weekChecks = [...state.weekChecks.filter((x) => x.id !== id), { id, projectId: t.projectId, taskId, week, date: day, by }];
      }
    },
    /** 마일스톤 승인 (msApprove) — 변경 이력 "마일스톤 승인 — 이름" */
    async approveMilestone(taskId: string, by: string, byName: string, day = todayStr()) {
      const t = state.tasks.find((x) => x.id === taskId);
      if (!t) throw new Error('업무를 찾을 수 없습니다');
      state.msOk = [...state.msOk.filter((x) => x.id !== taskId), { id: taskId, date: day, by }];
      log(t.projectId, t.code, '수정', `마일스톤 승인 — ${byName}`, by, day);
    },
    /** 액션 아이템 완료 · 다시 열기 (actDone) */
    async setActionDone(id: string, done: boolean, by: string, day = todayStr()) {
      const a = state.actions.find((x) => x.id === id);
      if (!a) throw new Error('액션 아이템을 찾을 수 없습니다');
      a.done = done;
      a.doneDate = done ? day : '';
      a.doneBy = done ? by : '';
    },

    /**
     * 세부 작업 추가 (subNew). 남에게 배정하면서 예정일을 정했고 받는 사람이 그날 계획을 이미 고쳐 저장했으면 거기에도 넣음
     * (안 고친 날은 자동 초안에 예정일 세부 작업으로 들어감 — subAdd 5832)
     */
    async addSubtask(taskId: string, text: string, assigneeId: string, due: string, by: string, day = todayStr(), estHours = 0): Promise<PmSubtask> {
      const order = Math.max(-1, ...state.subtasks.filter((s) => s.taskId === taskId).map((s) => s.order)) + 1;
      const s: PmSubtask = { id: nid('s'), taskId, text, assigneeId, due, estHours: +estHours || 0, done: false, doneDate: '', doneBy: '', memo: '', createdBy: by, createdDate: day, fromFp: false, order, legacyKey: '' };
      state.subtasks.push(s);
      if (assigneeId && assigneeId !== by && due) {
        const sv = planOf(assigneeId, due);
        if (sv && !sv.items.some((x) => x.subId === s.id)) sv.items.push({ taskId, subId: s.id, ...(s.estHours ? { hours: s.estHours } : {}) });
      }
      return clone(s);
    },
    /** 고치기 — 완료 체크면 완료한 날 · 사람(by)도 (데모 subDone · planDone: dd · ddBy) */
    async updateSubtask(id: string, patch: Partial<Omit<PmSubtask, 'id' | 'taskId' | 'doneDate' | 'doneBy'>>, by: string, day = todayStr()) {
      const s = state.subtasks.find((x) => x.id === id);
      if (!s) throw new Error('세부 작업을 찾을 수 없습니다');
      Object.assign(s, patch);
      if ('done' in patch) { s.doneDate = patch.done ? day : ''; s.doneBy = patch.done ? by : ''; }
    },
    async removeSubtask(id: string) {
      const xt = state.tickets.filter((x) => x.subtaskId === id && x.status !== '취소').pop();
      if (xt && tkOpen(xt)) throw new Error(`티켓 ${xt.no}이(가) 진행 중이라 지울 수 없습니다. 티켓을 먼저 발행 취소하세요`);
      state.subtasks = state.subtasks.filter((x) => x.id !== id);
    },

    // ── 티켓 (2단계) ──────────────────────────────────
    /** 발행 — 번호는 저장소가 붙인다 (no 는 무시). 이미 발행된 업무·세부 작업은 거부 */
    async issueTickets(list: readonly PmTicket[]): Promise<PmTicket[]> {
      for (const x of list) {
        const dup = state.tickets.some((v) => v.status !== '취소' && v.taskId === x.taskId && v.subtaskId === x.subtaskId && !v.legacyKey);
        if (dup) throw new Error(`이미 발행된 ${x.subtaskId ? '세부 작업' : '업무'}가 있습니다 (${x.title})`);
      }
      return list.map((x) => clone(pushTicket(x)));
    },
    /** 상태 이동 (tkMove) → 안내 문구 */
    async moveTicket(no: string, to: PmTicket['status'], cmt: string, me: string, nameOf: (id: string) => string, day = todayStr()): Promise<string> {
      const i = findTicket(no);
      const r = moveTicket(state.tickets[i], to, cmt, me, day, nameOf);
      if (!r.ok) throw new Error(r.error);
      state.tickets[i] = r.ticket;
      syncSub(r.ticket, day, me, r.subDone);
      return r.message;
    },
    /** 칸 고치기 결과 저장 (applyTicketDraft·setTicketProg 등 domain 계산 결과) */
    async putTicket(x: PmTicket) {
      const i = findTicket(x.no);
      state.tickets[i] = clone(x);
      syncSub(x, todayStr(), '', null);
    },
    async commentTicket(no: string, text: string, me: string, day = todayStr()) {
      const i = findTicket(no);
      state.tickets[i].hist.push({ date: day, by: me, text: `💬 ${text}`, comment: true });
    },
    async addTicketFile(no: string, name: string, me: string, day = todayStr()) {
      const x = state.tickets[findTicket(no)];
      x.files.push({ name, date: day, by: me });
      x.hist.push({ date: day, by: me, text: `산출물 첨부 — ${name}` });
    },
    async removeTicketFile(no: string, index: number, me: string, day = todayStr()) {
      const x = state.tickets[findTicket(no)];
      const f = x.files.splice(index, 1)[0];
      if (f) x.hist.push({ date: day, by: me, text: `산출물 삭제 — ${f.name}` });
    },

    // ── 사업 현황 (3단계) ─────────────────────────────
    /**
     * 기한 완료 체크 (govChk · planChk · 지난 기한 정리 pastDone). 관리기준 = 완료 기록, 계획서 약속 = 체크.
     * bulk = 지난 기한 정리로 한꺼번에 (처리한 날 남김)
     */
    async checkDeadlines(items: ReadonlyArray<{ projectId: string; kind: 'gov' | 'plan'; id: string }>, date: string, by: string, bulk: boolean, day = todayStr()) {
      for (const x of items) {
        const id = `${x.projectId}|${x.id}`;
        if (x.kind === 'gov') {
          state.gov = state.gov.filter((r) => r.id !== id);
          state.gov.push({ id, projectId: x.projectId, itemId: x.id, v: '', date, by, memo: '', fix: '', items: [], bulk: bulk ? day : '' });
        } else {
          state.planChecks = state.planChecks.filter((r) => r.id !== id);
          state.planChecks.push({ id, projectId: x.projectId, dutyId: x.id, date, by, bulk: bulk ? day : '' });
        }
      }
    },
    /** 완료 체크 풀기 */
    async uncheckDeadline(projectId: string, kind: 'gov' | 'plan', itemId: string) {
      const id = `${projectId}|${itemId}`;
      if (kind === 'gov') state.gov = state.gov.filter((r) => r.id !== id);
      else state.planChecks = state.planChecks.filter((r) => r.id !== id);
    },
    /**
     * 점검 판정 기록 (govResSave). 보완이 아니면 지적 사항·후속 기한은 지움.
     * 지적 사항은 id 로 이전 상태·이력을 이어 받음
     */
    async setGovResult(projectId: string, itemId: string, x: { v: string; date: string; memo: string; fix: string; items: Array<{ id: string; text: string; whoId: string }> }, by: string) {
      const id = `${projectId}|${itemId}`;
      const old = state.gov.find((r) => r.id === id);
      const items = x.v === '보완'
        ? x.items.filter((it) => it.text.trim()).map((it) => {
          const o = old?.items.find((y) => y.id === it.id);
          return o ? { ...clone(o), text: it.text.trim(), whoId: it.whoId } : { id: it.id || nid('GI'), text: it.text.trim(), whoId: it.whoId, st: '조치 전' as const, hist: [] };
        })
        : [];
      state.gov = state.gov.filter((r) => r.id !== id);
      state.gov.push({ id, projectId, itemId, v: x.v, date: x.date, by, memo: x.memo.trim(), fix: x.v === '보완' ? x.fix : '', items, bulk: '' });
    },
    /** 판정 기록 지우기 (govResDel) */
    async removeGovResult(projectId: string, itemId: string) {
      const id = `${projectId}|${itemId}`;
      state.gov = state.gov.filter((r) => r.id !== id);
    },
    /** 지적 사항 상태 (govItemSt) — 반려 = 사유 필수, 조치 전으로 */
    async setFixItemState(projectId: string, itemId: string, fixId: string, action: '조치 완료' | '확인' | '반려' | '조치 전', note: string, by: string, day = todayStr()) {
      const r = state.gov.find((x) => x.id === `${projectId}|${itemId}`);
      const it = r?.items.find((x) => x.id === fixId);
      if (!it) throw new Error('지적 사항을 찾을 수 없습니다');
      if (action === '반려' && !note.trim()) throw new Error('반려 사유를 적어 주세요');
      it.hist.push({ date: day, by, a: action, note: note.trim() });
      it.st = action === '반려' ? '조치 전' : action;
    },
    /**
     * 협약변경 기록 저장 (agrForm onSubmit). 기간 연장을 '승인' · '등록 완료'로 처음 저장하면 협약 종료일을 바꿈
     * → 돌려주는 글: 종료일을 바꿨으면 그 안내
     */
    async saveAgreement(x: PmAgreementChange, by: string): Promise<string> {
      const rec = { ...clone(x), by, to: x.kind === 'ext' ? x.to : '' };
      const i = state.agreements.findIndex((a) => a.id === rec.id);
      if (i >= 0) state.agreements[i] = rec; else state.agreements.push(rec);
      if (rec.kind === 'ext' && (rec.st === '승인' || rec.st === '등록 완료') && !rec.applied) {
        rec.applied = true;
        const p = state.projects.find((v) => v.id === rec.projectId);
        if (p) p.end = rec.to;
        return rec.to;
      }
      return '';
    },
    /** 협약변경 기록 지우기 — 이미 바뀐 협약 종료일은 그대로 */
    async removeAgreement(id: string) {
      state.agreements = state.agreements.filter((a) => a.id !== id);
    },
    /** 관리기준 필수 TASK 직접 연결 (glSave) · null = 자동으로 되돌리기 (glAuto) */
    async setGovLink(projectId: string, itemId: string, taskIds: string[] | null) {
      const id = `${projectId}|${itemId}`;
      state.govLinks = state.govLinks.filter((r) => r.id !== id);
      if (taskIds) state.govLinks.push({ id, projectId, itemId, taskIds: [...taskIds] });
    },
    /** 업무 일정만 고침 (govDateSave · msRevert) — 변경 이력 "일정 A~B → C~D (note)" + 티켓 반영. 바뀐 개수 */
    async setTaskDates(items: ReadonlyArray<{ id: string; start: string; end: string }>, note: string, by: string, day = todayStr()) {
      let n = 0;
      for (const x of items) {
        const i = findTask(x.id);
        const old = state.tasks[i];
        if (old.start === x.start && old.end === x.end) continue;
        const next = { ...clone(old), start: x.start, end: x.end };
        state.tasks[i] = next;
        const tk = syncTickets(old, next, by, day);
        log(old.projectId, old.code, '수정', `일정 ${old.start || '-'}~${old.end || '-'} → ${x.start}~${x.end} (${note})${tk}`, by, day);
        n++;
      }
      return n;
    },
    /** 선정 결과 (bidSetRes) — 탈락 = 현황·알림에서 빠짐, 업무와 기록은 그대로 */
    async setBidResult(projectId: string, v: '' | '선정' | '탈락', by: string, day = todayStr()) {
      const p = state.projects.find((x) => x.id === projectId);
      if (!p || p.bidRes === v) return;
      const old = p.bidRes;
      p.bidRes = v;
      p.bidAt = v ? { date: day, by } : null;
      log(projectId, '-', '수정', v ? `선정 결과 '${v}' 기록` : `선정 결과 지움 (이전: ${old})`, by, day);
    },

    // ── 업무계획 (3-6) ──────────────────────────────
    /** 그날 계획 저장 (planSet) — 고치는 순간 그날은 '수정함' */
    async setPlanDay(who: string, date: string, items: readonly PmPlanItem[]) {
      const next = items.map(({ auto: _a, ...x }) => clone(x));
      state.planDays = [...state.planDays.filter((p) => !(p.who === who && p.date === date)), { id: `${who}|${date}`, who, date, items: next }];
    },
    /** 어제 남은 일이 자동으로 넘어오기 시작하는 날 — 처음 한 번만 (S.carryFrom) */
    async ensureCarryFrom(date: string) {
      if (!state.settings.carryFrom) state.settings.carryFrom = date;
    },
    /** 반복 업무 추가 (planRepAdd) — 이미 직접 고친 앞날(오늘부터)에도 맨 앞에 넣음 */
    async addPlanRep(who: string, wd: number[], text: string, day = todayStr()) {
      const cur = state.planReps.find((r) => r.id === who) ?? { id: who, items: [] };
      state.planReps = [...state.planReps.filter((r) => r.id !== who), { id: who, items: [...cur.items, { wd: [...wd], text }] }];
      for (const p of state.planDays) if (p.who === who && p.date >= day && wd.includes(wdOf(p.date)) && !p.items.some((x) => x.text === text)) p.items.unshift({ text, rep: true });
    },
    async removePlanRep(who: string, index: number) {
      const cur = state.planReps.find((r) => r.id === who);
      if (cur) cur.items.splice(index, 1);
    },
    /** 일일 업무 보고 임시저장 (pdfDraftSave) — 30일 지난 내 임시저장은 지움 */
    async savePdfDraft(x: Omit<PmPdfDraft, 'id'>, day = todayStr()) {
      const cut = addDays(day, -30);
      state.pdfDrafts = [...state.pdfDrafts.filter((r) => !(r.who === x.who && (r.date === x.date || r.date < cut))), { ...clone(x), id: `${x.who}|${x.date}` }];
    },
    async removePdfDraft(who: string, date: string) {
      state.pdfDrafts = state.pdfDrafts.filter((r) => !(r.who === who && r.date === date));
    },

    // ── 3-7: 성과지표 · 알림 · 즐겨찾기 ───────────────
    /** 성과지표 직접 등록 · 수정 (kpiDefForm) */
    async saveKpiDef(x: Omit<PmKpiDef, 'id'> & { id?: string }) {
      const id = x.id || nid('KD');
      state.kpiDefs = [...state.kpiDefs.filter((r) => r.id !== id), { ...clone(x), id }];
      return id;
    },
    /** 직접 등록 지표 지우기 — 그 지표 실측 기록도 같이 */
    async removeKpiDef(id: string) {
      const d = state.kpiDefs.find((r) => r.id === id);
      state.kpiDefs = state.kpiDefs.filter((r) => r.id !== id);
      if (d) state.kpiMeas = state.kpiMeas.filter((m) => !(m.projectId === d.projectId && m.kid === id));
    },
    /** 실측 기록 (kpiMeasForm) — 수정이면 기록한 사람은 그대로 */
    async saveKpiMeas(x: Omit<PmKpiMeas, 'id' | 'who'> & { id?: string }, by: string) {
      const old = x.id ? state.kpiMeas.find((r) => r.id === x.id) : undefined;
      const id = old?.id || nid('KM');
      state.kpiMeas = [...state.kpiMeas.filter((r) => r.id !== id), { ...clone(x), id, who: old?.who ?? by }];
    },
    async removeKpiMeas(id: string) {
      state.kpiMeas = state.kpiMeas.filter((r) => r.id !== id);
    },
    /** AI 성능 측정 기록 (aiMeasForm) — 추가만 (데모도 수정 · 삭제 없음) */
    async addAiMeas(x: Omit<PmAiMeas, 'id' | 'who'>, by: string) {
      state.aiMeas.push({ ...clone(x), id: nid('AM'), who: by });
    },
    /** 알림 확인 · 되돌리기 (bellSeen) */
    async setSeen(who: string, txt: string, on: boolean, day = todayStr()) {
      const cur = state.seen.find((r) => r.id === who) ?? { id: who, items: {} };
      const items = { ...cur.items };
      if (on) items[txt] = day; else delete items[txt];
      state.seen = [...state.seen.filter((r) => r.id !== who), { id: who, items }];
    },
    /** 즐겨찾기 켜기 · 끄기 (favTog) — 새 것은 맨 뒤 */
    async toggleFav(who: string, f: { v: string; k: string }) {
      const cur = state.favs.find((r) => r.id === who)?.items ?? [];
      const has = cur.some((x) => x.v === f.v && x.k === f.k);
      const items = has ? cur.filter((x) => !(x.v === f.v && x.k === f.k)) : [...cur, { ...f }];
      state.favs = [...state.favs.filter((r) => r.id !== who), { id: who, items }];
      return !has;
    },

    // ── 4단계: 산출물 ─────────────────────────────────
    /** 산출물 상태 고르기 (docSet) — 올린 파일 이름은 그대로 둠 */
    async setDoc(taskId: string, st: PmDoc['st'], by: string, day = todayStr()) {
      const t = state.tasks.find((x) => x.id === taskId);
      if (!t) throw new Error('업무를 찾을 수 없습니다');
      const old = state.docs.find((d) => d.id === taskId);
      state.docs = [...state.docs.filter((d) => d.id !== taskId), { id: taskId, projectId: t.projectId, st, file: old?.file ?? '', date: day, by }];
    },
    /** 산출물 파일 올리기 (docUp) — 올리면 '제출완료'. 파일 보관은 7단계(Storage), 지금은 이름만 (데모도 이름만) */
    async uploadDoc(taskId: string, fileName: string, by: string, day = todayStr()) {
      const t = state.tasks.find((x) => x.id === taskId);
      if (!t) throw new Error('업무를 찾을 수 없습니다');
      state.docs = [...state.docs.filter((d) => d.id !== taskId), { id: taskId, projectId: t.projectId, st: '제출완료', file: fileName, date: day, by }];
    },

    // ── 5단계: 이슈 ──────────────────────────────────
    /** 이슈 등록 (issueForm 새로) — 번호 붙여 맨 앞에, 긴급이면 보고됨 */
    async addIssue(x: Omit<PmIssue, 'id' | 'by' | 'at' | 'esc'>, by: string, day = todayStr()): Promise<PmIssue> {
      const i: PmIssue = { ...clone(x), id: nextIssueId(state.issues), by, at: day, esc: x.sev === '긴급' };
      state.issues.unshift(i);
      return clone(i);
    },
    /** 이슈 수정 — 등록한 사람 · 등록일 · 보고됨은 그대로 */
    async updateIssue(id: string, x: Omit<PmIssue, 'id' | 'by' | 'at' | 'esc'>) {
      const i = state.issues.find((v) => v.id === id);
      if (!i) throw new Error('이슈를 찾을 수 없습니다');
      Object.assign(i, clone(x));
    },
    async removeIssue(id: string) {
      state.issues = state.issues.filter((v) => v.id !== id);
    },
    /** 윗선 보고 (esc 5938) — 긴급으로, 열림이면 대응중으로 */
    async escalateIssue(id: string) {
      const i = state.issues.find((v) => v.id === id);
      if (!i) throw new Error('이슈를 찾을 수 없습니다');
      i.esc = true;
      i.sev = '긴급';
      if (i.status === '열림') i.status = '대응중';
    },

    // ── 5단계: 회의록 · 액션 아이템 ──────────────────────
    /** 회의록 작성 (mtForm 새로) → id */
    async addMeeting(x: Omit<PmMeeting, 'id' | 'by' | 'at'>, by: string, day = todayStr()): Promise<string> {
      const id = nid('M');
      state.meetings.push({ ...clone(x), id, by, at: day });
      return id;
    },
    /** 회의록 수정 — 이 회의에서 나온 액션 아이템의 사업도 따라감 (데모 kSet 은 어디서도 켜지 않음) */
    async updateMeeting(id: string, x: Omit<PmMeeting, 'id' | 'by' | 'at'>) {
      const m = state.meetings.find((v) => v.id === id);
      if (!m) throw new Error('회의록을 찾을 수 없습니다');
      Object.assign(m, clone(x));
      for (const a of state.actions) if (a.meetingId === id) a.projectId = m.projectId;
    },
    /** 회의록 삭제 — 연결된 액션 아이템은 남기고 출처만 지움 */
    async removeMeeting(id: string) {
      state.meetings = state.meetings.filter((v) => v.id !== id);
      for (const a of state.actions) if (a.meetingId === id) a.meetingId = '';
    },
    /** 액션 아이템 추가 (actForm 새로) */
    async addAction(x: Pick<PmAction, 'text' | 'whoId' | 'due' | 'projectId' | 'meetingId'>, by: string, day = todayStr()): Promise<PmAction> {
      const a: PmAction = { ...clone(x), id: nid('A'), by, at: day, done: false, doneDate: '', doneBy: '' };
      state.actions.push(a);
      return clone(a);
    },
    /** 액션 아이템 수정 — 완료를 새로 켜면 완료일 · 누가, 끄면 지움 */
    async updateAction(id: string, x: Pick<PmAction, 'text' | 'whoId' | 'due' | 'projectId' | 'meetingId' | 'done'>, by: string, day = todayStr()) {
      const a = state.actions.find((v) => v.id === id);
      if (!a) throw new Error('액션 아이템을 찾을 수 없습니다');
      const was = a.done;
      Object.assign(a, clone(x));
      if (x.done && !was) { a.doneDate = day; a.doneBy = by; }
      if (!x.done) { a.doneDate = ''; a.doneBy = ''; }
    },
    async removeAction(id: string) {
      state.actions = state.actions.filter((v) => v.id !== id);
    },

    // ── 6단계: 사업 등록 · 정보 수정 · 삭제 (siteForm 2919) ──
    /**
     * 사업 등록 — tpl: 'std' = 기준정보 표준 업무 자동 생성 · 템플릿 ID = 그 사업 업무 복사 · '' = 만들지 않음.
     * 만든 업무는 협약 기간에 맞춰 날짜를 잡고 '최초 계획 (템플릿 적용)' 기준선을 만듦 → 만든 업무 수
     */
    async addProject(p: PmProject, tpl: string, keepPeople: boolean, by: string, day = todayStr()): Promise<number> {
      if (state.projects.some((x) => x.id === p.id) || state.tasks.some((t) => t.projectId === p.id)) throw new Error('이미 사용 중인 사업키입니다');
      state.projects.push(clone(p));
      syncMaster();
      const t = tpl === 'std' ? null : state.templates.find((x) => x.id === tpl);
      const src = tpl === 'std' ? stdTplTasks(state, p.biz) : t ? baseTplTasks(state.projects.find((x) => x.id === t.baseId), state.tasks) : [];
      if (!src.length) return 0;
      const ts = makeTasks(p, src, keepPeople, nextOrder());
      state.tasks.push(...ts);
      log(p.id, '-', '추가', `템플릿 '${tpl === 'std' ? '기준정보 표준 TASK' : t!.name}' 적용 — TASK ${ts.length}건`, by, day);
      state.baselines = [...state.baselines.filter((b) => b.id !== p.id), makeBaseline(p.id, ts, '최초 계획 (템플릿 적용)', day, by)];
      return ts.length;
    },
    /** 사업 정보 수정 — 사업키는 그대로. 기업 이름이 새로 생기면 기준정보에 자동 추가 */
    async updateProject(next: PmProject, by: string, day = todayStr()) {
      const i = state.projects.findIndex((x) => x.id === next.id);
      if (i < 0) throw new Error('사업을 찾을 수 없습니다');
      state.projects[i] = clone(next);
      syncMaster();
      log(next.id, '-', '수정', '사업 정보 수정', by, day);
    },
    /** 업무 여러 건 완료 (prePastDone — 등록 때 '이미 한 일') */
    async completeTasks(ids: readonly string[], note: string, by: string, day = todayStr()) {
      for (const id of ids) { const i = findTask(id); state.tasks[i] = { ...state.tasks[i], status: '완료', actualPct: 100 }; }
      const p = ids.length ? state.tasks[findTask(ids[0])].projectId : '';
      if (p) log(p, '-', '수정', `${note} — TASK ${ids.length}건 완료 처리`, by, day);
    },
    /** 사업 삭제 — 발행된 티켓이 있으면 막음. 업무 · 이슈 · CR · 액션 · 사업에 딸린 기록을 같이 지우고, 회의록은 '공통'으로 */
    async removeProject(id: string, by: string, day = todayStr()) {
      // 옛 화면에서 이미 지워진 사업을 또 지움 (K3 로 다시 읽은 뒤라 없음) → 멈춤, '사업 삭제 — TASK 0건' 이력도 안 남김
      if (!state.projects.some((x) => x.id === id)) throw new Error('사업을 찾을 수 없습니다 (이미 삭제됐을 수 있습니다)');
      const tks = state.tickets.filter((x) => x.projectId === id && x.status !== '취소');
      if (tks.length) throw new Error(`발행된 티켓 ${tks.length}건이 있어 삭제할 수 없습니다. 티켓을 먼저 발행 취소하세요.`);
      const n = state.tasks.filter((t) => t.projectId === id).length;
      const gone = new Set(state.tasks.filter((t) => t.projectId === id).map((t) => t.id));
      state.projects = state.projects.filter((x) => x.id !== id);
      state.tasks = state.tasks.filter((t) => t.projectId !== id);
      state.subtasks = state.subtasks.filter((x) => !gone.has(x.taskId));
      // N1 (11/26 팀장, 데모와 다름): 업무 번호에 걸린 세부 기능 · 완료 기록 · 마일스톤 승인 · 표준 연결과 취소된 티켓도 —
      // 같은 사업키로 다시 등록하면 같은 업무 번호가 생겨 옛 기록이 새 업무에 붙음 (데모 siteDel 은 S.fn · S.tickets 를 남김)
      state.functions = state.functions.filter((x) => !gone.has(x.id));
      state.done = state.done.filter((x) => !gone.has(x.id));
      state.msOk = state.msOk.filter((x) => !gone.has(x.id));
      state.tlinks = state.tlinks.filter((x) => !gone.has(x.id));
      state.tickets = state.tickets.filter((x) => x.projectId !== id);
      // 결정 (가) 11/26 팀장: 성과지표 3종 · 진행률 갱신 요청도 지우고, 사업 번호는 다시 안 씀 (업무계획 줄 · 나중에 할 일은 데모 그대로 남김)
      state.kpiDefs = state.kpiDefs.filter((x) => x.projectId !== id);
      state.kpiMeas = state.kpiMeas.filter((x) => x.projectId !== id);
      state.aiMeas = state.aiMeas.filter((x) => x.projectId !== id);
      state.updReq = state.updReq.filter((x) => x.projectId !== id);
      state.lastProjectNo = Math.max(state.lastProjectNo, projectNo(id), ...state.projects.map((p) => projectNo(p.id)));
      state.issues = state.issues.filter((x) => x.projectId !== id);
      state.crs = state.crs.filter((x) => x.projectId !== id);
      state.actions = state.actions.filter((x) => x.projectId !== id);
      for (const m of state.meetings) if (m.projectId === id) m.projectId = '';
      state.templates = state.templates.filter((x) => x.baseId !== id);
      state.baselines = state.baselines.filter((x) => x.id !== id);
      state.funds = state.funds.filter((x) => x.id !== id);
      for (const k of ['gov', 'planChecks', 'govLinks', 'agreements', 'docs', 'reports', 'weekChecks', 'contracts', 'pays', 'costs'] as const) (state[k] as Array<{ projectId: string }>) = (state[k] as Array<{ projectId: string }>).filter((x) => x.projectId !== id);
      log(id, '-', '삭제', `사업 삭제 — TASK ${n}건`, by, day);
    },

    // ── 6-2: 기준정보 › 사업 › 단계 › 업무 연결 (link*) · 업무 목록 생성 (gen*) ──
    /** 표준 업무 직접 연결 · 풀기 (linkSet · linkPick · linkUnset · sugApply) */
    async setTlinks(pairs: ReadonlyArray<readonly [string, string | null]>) {
      for (const [id, stdId] of pairs) {
        state.tlinks = state.tlinks.filter((l) => l.id !== id);
        if (stdId) state.tlinks.push({ id, stdId });
      }
    },
    /**
     * 표준 업무 → 이 사업 업무로 넣기 (linkAdd · linkAddAll · genApply) — 날짜 = 협약 시작 + 착수 후 일수(rows 가 주면 그 날짜),
     * 번호가 겹치면 '#2'. 표준과 바로 연결. 넣은 수
     */
    async addStdToProject(projectId: string, rows: ReadonlyArray<{ stdId: string; code?: string; start?: string; end?: string }>, note: string, by: string, day = todayStr()): Promise<number> {
      const p = state.projects.find((x) => x.id === projectId);
      if (!p) throw new Error('사업을 찾을 수 없습니다');
      const had = state.tasks.some((t) => t.projectId === projectId);
      let n = 0;
      for (const r of rows) {
        const x = state.stdTasks.find((s) => s.id === r.stdId);
        if (!x) continue;
        const start = r.start ?? addDays(p.start || day, +x.off || 0);
        const end = r.end ?? addDays(start, (+x.dur || 1) - 1);
        let code = r.code || x.code || nextCode(state.tasks, projectId, x.stage) || String(state.tasks.filter((t) => t.projectId === projectId).length + 1);
        const has = (w: string) => state.tasks.some((t) => t.projectId === projectId && t.code === w);
        if (has(code)) { let i = 2; while (has(`${code}#${i}`)) i++; code = `${code}#${i}`; }
        const t = pmTaskSchema.parse({ id: `${projectId}|${code}`, projectId, stage: x.stage, code, name: x.name, output: x.output, pmName: p.pmName, start, end, milestone: x.milestone, status: '계획', order: nextOrder() });
        state.tasks.push(t);
        state.tlinks.push({ id: t.id, stdId: x.id });
        if (rows.length === 1) log(projectId, code, '추가', `표준 세부 TASK 추가 — ${x.name}`, by, day);
        n++;
      }
      if (rows.length > 1 && n) log(projectId, '-', '추가', `${note} — TASK ${n}건`, by, day);
      if (!had && n && /생성/.test(note)) state.baselines = [...state.baselines.filter((b) => b.id !== projectId), makeBaseline(projectId, state.tasks.filter((t) => t.projectId === projectId), '최초 계획 (기준정보로 생성)', day, by)];
      return n;
    },
    /** 사업 업무를 표준에 추가 (linkToStd) */
    async stdFromTask(taskId: string) {
      const t = state.tasks[findTask(taskId)];
      const p = state.projects.find((x) => x.id === t.projectId);
      if (!p?.biz) throw new Error('사업구분이 없는 사업입니다');
      const s0 = p.start || t.start;
      state.stdTasks.push({ id: nid('t'), biz: p.biz, stage: t.stage, ord: stdOf(state.stdTasks, p.biz, t.stage).length + 1, code: t.code, name: t.name, output: t.output,
        off: t.start && s0 ? diffDaysLocal(s0, t.start) : 0, dur: t.start && t.end ? diffDaysLocal(t.start, t.end) + 1 : 1, milestone: t.milestone, from: t.projectId });
    },

    // ── 6-2: 코드 · 표준 세부 업무 · 기업 · 기관 (codeForm · stdForm · orgForm) ──
    /** 코드 저장 — 이름을 바꾸면 쓰는 곳도 (사업구분 → 사업 · 단계 · 표준, 단계 → 표준 · 그 사업구분 업무 + 변경 이력) → 바뀐 곳 수 */
    async saveCode(c: PmCode, by: string, day = todayStr()): Promise<number> {
      const old = state.codes.find((x) => x.id === c.id);
      if (!old) { const ord = c.group === 'stage' ? state.codes.filter((x) => x.group === 'stage' && x.biz === c.biz).length + 1 : 0; state.codes.push({ ...clone(c), ord, auto: false }); return 0; }
      const prev = old.name;
      Object.assign(old, clone(c), { auto: false, ord: old.ord, biz: old.biz || c.biz });
      if (prev === c.name) return 0;
      if (c.group === 'biz') {
        let n = 0;
        for (const p of state.projects) if (p.biz === prev) { p.biz = c.name; n++; }
        for (const s of state.codes) if (s.group === 'stage' && s.biz === prev) s.biz = c.name;
        for (const t of state.stdTasks) if (t.biz === prev) t.biz = c.name;
        return n;
      }
      if (c.group === 'stage') {
        for (const t of state.stdTasks) if (t.biz === old.biz && t.stage === prev) t.stage = c.name;
        const ks = new Set(state.projects.filter((p) => p.biz === old.biz).map((p) => p.id));
        let n = 0;
        for (const t of state.tasks) if (ks.has(t.projectId) && t.stage === prev) { t.stage = c.name; n++; }
        for (const k of ks) if (state.tasks.some((t) => t.projectId === k && t.stage === c.name)) log(k, '-', '수정', `단계명 변경 '${prev}' → '${c.name}'`, by, day);
        return n;
      }
      return 0;
    },
    /** 코드 지우기 — 쓰는 곳 · 아래 단계 · 표준 업무가 있으면 막음 */
    async removeCode(id: string) {
      const c = state.codes.find((x) => x.id === id);
      if (!c) return;
      const why = codeDelBlock(c, state);
      if (why) throw new Error(why);
      state.codes = state.codes.filter((x) => x.id !== id);
      if (c.group === 'stage') state.codes.filter((s) => s.group === 'stage' && s.biz === c.biz).sort((a, b) => a.ord - b.ord).forEach((s, i) => { s.ord = i + 1; });
    },
    /** 단계 순서 · 표준 업무 순서 바꾸기 (stageMove · stdMove) — dir = -1 위 · 1 아래 */
    async moveStage(id: string, dir: -1 | 1) {
      const c = state.codes.find((x) => x.id === id);
      if (!c) return;
      const a = state.codes.filter((s) => s.group === 'stage' && s.biz === c.biz).sort((x, y) => x.ord - y.ord);
      const i = a.indexOf(c); const j = i + dir;
      if (j < 0 || j >= a.length) return;
      [a[i], a[j]] = [a[j], a[i]];
      a.forEach((s, n) => { s.ord = n + 1; });
    },
    async moveStd(id: string, dir: -1 | 1) {
      const t = state.stdTasks.find((x) => x.id === id);
      if (!t) return;
      const a = stdOf(state.stdTasks, t.biz, t.stage);
      const i = a.indexOf(t); const j = i + dir;
      if (j < 0 || j >= a.length) return;
      [a[i], a[j]] = [a[j], a[i]];
      a.forEach((s, n) => { s.ord = n + 1; });
    },
    /** 표준 세부 업무 저장 — 단계를 옮기면 그 단계 맨 뒤, 원래 단계는 순서 다시 매김 */
    async saveStd(x: PmStdTask) {
      const old = state.stdTasks.find((s) => s.id === x.id);
      if (!old) { state.stdTasks.push({ ...clone(x), id: x.id || nid('t'), ord: stdOf(state.stdTasks, x.biz, x.stage).length + 1 }); return; }
      const prev = old.stage;
      Object.assign(old, clone(x), { ord: prev === x.stage ? old.ord : stdOf(state.stdTasks, x.biz, x.stage).length + 1 });
      if (prev !== x.stage) stdOf(state.stdTasks, x.biz, prev).forEach((s, i) => { s.ord = i + 1; });
    },
    async removeStd(id: string) {
      const t = state.stdTasks.find((x) => x.id === id);
      if (!t) return;
      state.stdTasks = state.stdTasks.filter((x) => x.id !== id);
      state.tlinks = state.tlinks.filter((l) => l.stdId !== id);
      stdOf(state.stdTasks, t.biz, t.stage).forEach((s, i) => { s.ord = i + 1; });
    },
    /** 기업 · 기관 저장 — 이름을 바꾸면 쓰는 사업의 그 칸도 (사업에서 쓰면 구분은 못 바꿈) → 바뀐 사업 수 */
    async saveOrg(o: PmOrg): Promise<number> {
      const old = state.orgs.find((x) => x.id === o.id);
      if (!old) { state.orgs.push({ ...clone(o), id: o.id || nid('o'), auto: false }); return 0; }
      const used = orgUse(old, state.projects);
      if (used.length && o.type !== old.type) throw new Error('사업에서 쓰는 중이라 구분을 바꿀 수 없습니다');
      const prev = old.name;
      Object.assign(old, clone(o), { auto: false });
      if (prev !== o.name) for (const p of used) p[ORG_FIELD[old.type]] = o.name;
      return prev !== o.name ? used.length : 0;
    },
    async removeOrg(id: string) {
      const o = state.orgs.find((x) => x.id === id);
      if (!o) return;
      const used = orgUse(o, state.projects);
      if (used.length) throw new Error(`사업 ${used.length}개(${used.map((p) => p.id).join(', ')})에서 쓰는 중이라 지울 수 없습니다`);
      state.orgs = state.orgs.filter((x) => x.id !== id);
    },

    // ── 6-4: 지원 기준 · 단가 · 품목 · 단가 ─────────────────
    /** 단가 · 계산 기준 (mnCfgForm) */
    /** 단가 · 계산 기준 창 칸만 저장 — 기본 월 간접비(ohDefault)는 간접비 창(saveOh)이 맡으므로 지금 값 그대로 (G1: 옛 화면 값으로 덮지 않게) */
    async saveMoneyCfg(c: PmMoneyCfg) {
      state.moneyCfg = pmMoneyCfgSchema.parse({ ...clone(c), ohDefault: state.moneyCfg.ohDefault });
    },
    /** 지원 기준 추가 · 수정 (mnRuleForm) — id 가 없으면 새로 */
    async saveFundRule(r: PmFundRule): Promise<PmFundRule> {
      const x = pmFundRuleSchema.parse({ ...clone(r), id: r.id || nid('F') });
      const i = state.fundRules.findIndex((v) => v.id === x.id);
      if (i < 0) state.fundRules.push(x); else state.fundRules[i] = x;
      return clone(x);
    },
    async removeFundRule(id: string) {
      state.fundRules = state.fundRules.filter((x) => x.id !== id);
    },
    /** 품목 추가 · 수정 (ciForm) — 이미 만든 견적은 그대로 (견적은 품목을 복사해 씀) */
    async saveItem(it: PmItem): Promise<PmItem> {
      const x = pmItemSchema.parse({ ...clone(it), id: it.id || nid('P') });
      const i = state.items.findIndex((v) => v.id === x.id);
      if (i < 0) state.items.push(x); else state.items[i] = x;
      return clone(x);
    },
    async removeItem(id: string) {
      state.items = state.items.filter((x) => x.id !== id);
    },

    // ── 6-5: 견적 작성 ─────────────────────────────────
    /**
     * 견적 저장 (qSave) — 계약 · 견적 새로 / 고치기, 고른 품목의 지난 견적에 이 견적 쌓기(qHist),
     * 정부지원이고 사업에 다른 정부지원 계약이 없으면 사업 재원(지원 기준 · 현물 · 지방비 확정)도 이 값으로,
     * 새 견적이면 지불조건 글(선급금 50% 등)로 대금 단계를 만듦. src = 사업 짧은 이름 (지난 견적 이름)
     */
    async saveQuote(E: QuoteDraft, src: string, day = todayStr()): Promise<{ c: PmContract; isNew: boolean }> {
      const e = quoteCheck(E);
      if (e) throw new Error(e[0]);
      if (!state.projects.some((p) => p.id === E.projectId)) throw new Error('사업을 찾을 수 없습니다');
      const ov = qOv(fundCtx(day), E);
      let c = E.cid ? state.contracts.find((x) => x.id === E.cid) : undefined;
      const isNew = !c;
      const next = pmContractSchema.parse({ id: c?.id ?? nid('C'), projectId: E.projectId, name: E.name.trim(), kind: E.kind, status: E.status, conf: true, note: E.note, q: clone(E.q), lines: qLines(E.q) });
      if (c) Object.assign(c, next); else { c = next; state.contracts.push(c); }
      qHist(state.items, c, src, day);
      // 다른 정부지원 계약이 있으면 사업 재원(확정 금액 등)은 건드리지 않음
      if (E.kind === '정부지원' && ov.solo) state.funds = [...state.funds.filter((x) => x.id !== E.projectId), clone(ov.f)];
      if (isNew && !state.pays.some((x) => x.cid === c!.id)) for (const p of paysFromTerms(E.q.pay)) state.pays.push(pmPaySchema.parse({ id: nid('D'), projectId: E.projectId, cid: c.id, ...p }));
      return { c: clone(c), isNew };
    },
    /** 계약 · 견적 삭제 (qDelC) — 그 계약의 대금 일정도 같이. 품목의 지난 견적 기록은 남음 (데모 그대로) */
    async removeContract(id: string) {
      state.contracts = state.contracts.filter((x) => x.id !== id);
      state.pays = state.pays.filter((x) => x.cid !== id);
    },
    /** 직접 쓴 줄 → 품목 · 단가 목록에 추가 (qReg1 · qRegister) — 새 품목 ID 들 (줄 순서) */
    async registerItems(lines: readonly PmQuoteItem[], src: string, date: string): Promise<string[]> {
      return lines.map((it) => { const x = lineToItem(it, nid('P'), src, date); state.items.push(x); return x.id; });
    },
    // ── 6-6: 사업별 수익 · 손익 ─────────────────────────
    /** 재원 수정 (mnFundForm) — 사람이 기준을 고른 것으로 (ruleSet) */
    async saveFund(f: PmFund) {
      if (!state.projects.some((p) => p.id === f.id)) throw new Error('사업을 찾을 수 없습니다');
      const x = pmFundSchema.parse({ ...clone(f), ruleSet: true });
      state.funds = [...state.funds.filter((v) => v.id !== x.id), x];
    },
    /** 대금 단계 추가 · 수정 (mnPayForm) — id 가 없으면 새로 */
    async savePay(p: PmPay): Promise<PmPay> {
      if (!state.contracts.some((c) => c.id === p.cid && c.projectId === p.projectId)) throw new Error('계약을 찾을 수 없습니다');
      const x = pmPaySchema.parse({ ...clone(p), id: p.id || nid('D') });
      const i = state.pays.findIndex((v) => v.id === x.id);
      if (i < 0) state.pays.push(x); else state.pays[i] = x;
      return clone(x);
    },
    async removePay(id: string) {
      state.pays = state.pays.filter((x) => x.id !== id);
    },
    /** 원가 변경 등록 · 수정 (mnCostForm) */
    async saveCost(c: PmCost): Promise<PmCost> {
      if (!state.projects.some((p) => p.id === c.projectId)) throw new Error('사업을 찾을 수 없습니다');
      const x = pmCostSchema.parse({ ...clone(c), id: c.id || nid('E') });
      const i = state.costs.findIndex((v) => v.id === x.id);
      if (i < 0) state.costs.push(x); else state.costs[i] = x;
      return clone(x);
    },
    async removeCost(id: string) {
      state.costs = state.costs.filter((x) => x.id !== id);
    },
    /** 간접비 입력 (mnOhForm) — 금액 · 내용 둘 다 비우면 그 달 기록 지움 · 기본 월 간접비 같이 저장 */
    async saveOh(m: string, amt: number | null, memo: string, def: number | null, by: string, day = todayStr()) {
      if (!/^\d{4}-\d{2}$/.test(m)) throw new Error('달은 2026-11처럼 넣어 주세요');
      state.oh = state.oh.filter((x) => x.id !== m);
      if (amt != null || memo.trim()) state.oh.push(pmOhSchema.parse({ id: m, amt, memo: memo.trim(), by, at: day }));
      state.moneyCfg = pmMoneyCfgSchema.parse({ ...state.moneyCfg, ohDefault: def });
    },

    // ── 5단계: 주간 진행률 · 보고서 ──────────────────────
    /** 금주 특이사항 · 협조 요청 저장 (wcNote · wcReq · rptNote · rptReq) — 주마다 */
    async setReport(projectId: string, week: string, patch: { note?: string; req?: string }, by: string, day = todayStr()) {
      const id = `${projectId}|${week}`;
      const old = state.reports.find((r) => r.id === id);
      state.reports = [...state.reports.filter((r) => r.id !== id), { id, projectId, week, note: old?.note ?? '', req: old?.req ?? '', ...patch, by, at: day }];
    },
    /** 진행률 갱신 요청 보내기 (updReq) — 받는 사람마다 1건 (마지막 요청) */
    async sendUpdRequest(whoId: string, projectId: string, by: string, day = todayStr()) {
      state.updReq = [...state.updReq.filter((r) => r.id !== whoId), { id: whoId, date: day, by, projectId }];
    },

    // ── 4단계: 요구사항(CR) ──────────────────────────────
    /** CR 접수 (crForm 새로) — 번호 붙여 맨 앞에, 검토중 */
    async addCr(x: Omit<PmChangeRequest, 'id' | 'status' | 'comment' | 'reviewer' | 'revD' | 'taskId' | 'by' | 'at'>, by: string, day = todayStr()): Promise<PmChangeRequest> {
      const id = nextCrId(state.crs);
      const c: PmChangeRequest = { ...clone(x), id, status: '검토중', comment: '', reviewer: '', revD: '', taskId: '', by, at: day };
      state.crs.unshift(c);
      return clone(c);
    },
    /** CR 수정 (crForm 고치기) — 접수 칸만, 상태 · 검토 기록은 그대로 */
    async updateCr(id: string, x: Pick<PmChangeRequest, 'projectId' | 'cat' | 'title' | 'desc' | 'req' | 'date' | 'prio' | 'days' | 'cost'>) {
      const c = state.crs.find((v) => v.id === id);
      if (!c) throw new Error('CR을 찾을 수 없습니다');
      Object.assign(c, clone(x));
    },
    async removeCr(id: string) {
      state.crs = state.crs.filter((v) => v.id !== id);
    },
    /** 검토 · 승인 (crReview) — 의견 필수, 검토중일 때만 */
    async reviewCr(id: string, decision: '승인' | '반려', comment: string, by: string, day = todayStr()) {
      const c = state.crs.find((v) => v.id === id);
      if (!c) throw new Error('CR을 찾을 수 없습니다');
      if (c.status !== '검토중') throw new Error(`${id}는 이미 ${c.status} 처리되었습니다`);
      if (!comment.trim()) throw new Error('검토 의견을 적어 주세요');
      Object.assign(c, { status: decision, comment: comment.trim(), reviewer: by, revD: day });
    },
    /** 승인한 CR 로 추가한 업무 잇기 (wbsForm preset.cr) */
    async linkCrTask(id: string, taskId: string) {
      const c = state.crs.find((v) => v.id === id);
      if (c) c.taskId = taskId;
    },

    /** 몰림 기준 주당 마감 (loadMax 6008: 1 이상, 잘못 넣으면 8) */
    async setLoadMax(v: number) {
      state.settings.loadMax = Math.max(1, Math.round(+v) || LOAD_MAX_DEFAULT);
    },

    /** 기준선 재설정 (baseSet) */
    async resetBaseline(projectId: string, label: string, by: string, day = todayStr()) {
      const ts = state.tasks.filter((t) => t.projectId === projectId);
      const b = makeBaseline(projectId, ts, label, day, by);
      state.baselines = [...state.baselines.filter((x) => x.id !== projectId), b];
      log(projectId, '', '기준선', `기준선 재설정 — ${label} (업무 ${ts.length}건)`, by, day);
    },
  };

  type Core = typeof core;
  type CoreKey = keyof Core;
  let generation = 0;
  let notices: string[] = [];
  const reads = {
    /** 사업비 구성 (fundOf) — 테스트 · 화면 확인용 */
    fundOf(k: string, day = todayStr()) { return fundOf(fundCtx(day), k); },
    /** 지금 상태 (다시 읽지 않음) + 세대 번호 */
    peek(): { snap: PmSnapshot; gen: number } { return { snap: clone(state), gen: generation }; },
    /** 저장 · 다시 읽기마다 +1 — 화면이 받은 읽기 결과가 이보다 옛것이면 버림 (K2) */
    gen: () => generation,
    /** 처음 열 때 점검 안내 (DB 모드, pm.manage 에게) */
    notices: () => [...notices],
  };

  if (!dbMode) {
    return {
      ...core,
      ...reads,
      /** 메모리 모드는 기준표를 안 봄 = 그냥 저장 함수 (동작 그대로) */
      withBase(_bases: PmBases): Core { return core; },
      async snapshot(): Promise<PmSnapshot> { return clone(state); },
      /** 메모리 모드는 다시 읽을 곳이 없음 = 지금 상태 */
      async refresh() { return reads.peek(); },
      onProgress(_fn: ((p: PmProgress) => void) | null) { /* 메모리는 바로 끝남 */ },
    };
  }

  // ── DB 모드: 저장 계층 (5.7.2 · 5.7.3) ──────────────────
  const sync = opts.db ? createPmSync(opts.db) : null;
  let loaded = false;
  let needReload = false;
  let empty = false;
  /** 저장 · 다시 읽기는 한 줄로 (K2) — 둘째 저장은 첫째가 다 쓰고 상태를 바꾼 뒤에 계산 */
  let tail: Promise<unknown> = Promise.resolve();
  const line = <T>(fn: () => Promise<T>): Promise<T> => {
    const p = tail.then(fn, fn);
    tail = p.catch(() => undefined);
    return p;
  };
  const reload = async () => {
    if (!sync) throw new Error(opts.blocked);
    const r = await sync.load(emptyState());
    state = r.snap;
    rekeyMarks = r.rekeyMarks;
    notices = r.notices;
    empty = r.empty;
    stdSeeded = true;
    loaded = true;
    needReload = false;
    generation++;
  };
  /** 실패 뒤 다시 읽기 — 이것도 안 되면 다음 저장 전에 다시 읽게 표시만 */
  const reloadAfterFail = async () => { try { await reload(); } catch { needReload = true; } };
  const ensure = async () => { if (!loaded || needReload) await reload(); };
  /** 계산 전에 DB 전체를 다시 읽는 저장 (K3) — 여러 컬렉션을 지우거나 옮김 */
  const K3: Partial<Record<CoreKey, (a: unknown[]) => boolean>> = {
    removeProject: () => true, removeStd: () => true, removeCode: () => true, removeMeeting: () => true,
    // F3: 딸린 것을 같이 지우거나 '쓰는 중이면 막음' 검사가 있는 지우기 — 옛 화면이면 남이 새로 단 것을 모르고 지우거나 검사가 틀림 (표 = 설계 5.7.2)
    removeContract: () => true, removeKpiDef: () => true, removeSubtask: () => true, removeOrg: () => true,
    // 사업 등록 · 수정은 기준정보(기업 · 사업구분)를 이름으로 더함 (syncMaster) — 옛 화면이면 남이 방금 넣은 기업을 모르고 같은 이름을 또 만듦
    addProject: () => true,
    updateProject: (a) => { const n = a[0] as PmProject; const o = state.projects.find((x) => x.id === n?.id); return !o || (['company', 'supplier', 'org', 'biz'] as const).some((f) => (o[f] || '') !== (n[f] || '')); },
    updateTask: (a) => (a[1] as PmTask)?.id !== a[0],
    saveCode: (a) => { const c = a[0] as PmCode; const o = state.codes.find((x) => x.id === c?.id); return !!o && o.name !== c.name; },
  };

  /** (c) 덧막이 — K3 로 다시 읽기 전 · 뒤에 이번 저장이 통째로 고치는 기록이 바뀌었으면 충돌 (표 없이 불려도) */
  const K3_TARGET: Partial<Record<CoreKey, (a: unknown[]) => PmBase>> = {
    updateProject: (a) => ({ field: 'projects', id: (a[0] as PmProject)?.id, rec: null }),
    updateTask: (a) => ({ field: 'tasks', id: String(a[0]), rec: null }),
    saveCode: (a) => ({ field: 'codes', id: (a[0] as PmCode)?.id, rec: null }),
  };

  const run = (name: CoreKey, args: unknown[], bases?: PmBases) => line(async () => {
    await ensure();
    if (empty) throw new PmDbSaveError(MSG.empty);
    for (let attempt = 1; ; attempt++) {
      if (K3[name]?.(args)) {
        const t = K3_TARGET[name]?.(args);
        if (t) t.rec = clone(baseCur(state, t));
        await reload();
        if (t && t.rec !== null && !baseSame(state, t)) throw new PmStaleWindowError();
      }
      // F5: 창이 연 때 기록 ≠ 지금 기록 → 아무것도 안 씀 (다시 읽지 않음 — 저장소가 이미 더 새 것을 앎)
      if (bases?.some((b) => !baseSame(state, b))) throw new PmStaleWindowError();
      const prev = state;
      const draft = clone(prev);
      state = draft;
      rekeyed = [];
      let res: unknown;
      try {
        res = await (core[name] as (...a: unknown[]) => Promise<unknown>)(...args);
      } finally {
        state = prev;
      }
      const p = sync!.plan(draft, rekeyed);
      if (p.writes) {
        try {
          await sync!.check(p);
          await sync!.write(p);
        } catch (e) {
          if (e instanceof PmNumberTakenError && attempt < 3) { await reloadAfterFail(); continue; }
          await reloadAfterFail();
          if (e instanceof PmNumberTakenError) throw new PmDbSaveError(MSG.number);
          if (e instanceof PmProjectTakenError) throw new PmDbSaveError(MSG.project(e.id));
          if (e instanceof PmConflictError) throw e;
          if (e instanceof PmPartialError) throw new PmDbSaveError(MSG.partial, true);
          throw new PmDbSaveError(`${MSG.failed} — ${(e as Error)?.message ?? e}`);
        }
      }
      state = draft;
      generation++;
      for (const b of bases ?? []) b.rec = clone(baseCur(state, b));
      return res;
    }
  });
  const wrapOf = (bases?: PmBases) => Object.fromEntries((Object.keys(core) as CoreKey[]).map((k) => [k, (...a: unknown[]) => run(k, a, bases)])) as unknown as Core;
  const wrapped = wrapOf();
  return {
    ...wrapped,
    ...reads,
    /** 기준표를 같이 넘기는 저장 (F5) — `s.withBase(표).updateTask(…)` */
    withBase(bases: PmBases): Core { return wrapOf(bases); },
    async snapshot(): Promise<PmSnapshot> { return line(async () => { await ensure(); return clone(state); }); },
    /** DB 전체 다시 읽기 (같은 줄에서 — 저장 사이에만) → 상태 + 세대 */
    async refresh() { return line(async () => { await reload(); return reads.peek(); }); },
    /** 쓰기가 20건 넘는 저장의 진행 (저장 중 n / 전체) — 화면 표시는 7-6 */
    onProgress(fn: ((p: PmProgress) => void) | null) { sync?.onProgress(fn); },
  };
}

export type PmStore = ReturnType<typeof createPmStore>;

/** 화면 훅이 쓰는 읽기 — 늦게 도착한 옛 읽기 결과는 버리고 지금 상태로 (K2 b) */
export async function latestSnapshot(s: PmStore): Promise<PmSnapshot> {
  const r = await s.refresh();
  return r.gen < s.gen() ? s.peek().snap : r.snap;
}
