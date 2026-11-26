import type { ZodTypeAny } from 'zod';
import {
  pmActionSchema, pmAgreementChangeSchema, pmBaselineSchema, pmChangeLogSchema, pmChangeRequestSchema, pmCodeSchema, pmDocSchema, pmGovLinkSchema,
  pmGovRecordSchema, pmIssueSchema, pmLaterSchema, pmMeetingSchema, pmMilestoneOkSchema, pmOrgSchema, pmPdfDraftSchema, pmPlanCheckSchema, pmPlanDaySchema,
  pmPlanRepSchema, pmProjectSchema, pmReportSchema, pmStdTaskSchema, pmSubtaskSchema, pmTaskDoneSchema, pmTaskFunctionsSchema, pmTaskSchema, pmTemplateSchema,
  pmUpdRequestSchema, pmWeekCheckSchema,
} from '@/domain/pm/schema';
import { pmTicketSchema } from '@/domain/pm/ticket';
import { pmFundRuleSchema, pmItemSchema, pmMoneyCfgSchema } from '@/domain/pm/money';
import { pmContractSchema, pmFundSchema, pmPaySchema } from '@/domain/pm/quote';
import { pmCostSchema, pmOhSchema } from '@/domain/pm/pl';
import type { PmSnapshot } from './pm.store';

/**
 * PM DB 컬렉션 23개 — 스냅숏 칸 48개를 어느 컬렉션 · 어느 종류(kind)로 두는지 (설계 5.7.1).
 * 한 문서 = `{ id, kind, 찾는 칸, at, seq, body }` — body 에 기록 전체를 JSON 글자로.
 * 7-3 의 스키마 정의(`appwrite-schema.ts`) · 7-5 옮기기도 이 표를 쓴다.
 */

/** DB 한 줄 (Appwrite 문서 속성과 같음). `$id` = safeDocId(docKey) */
export interface PmRow {
  /** 기록 id (여러 종류를 묶은 컬렉션이면 종류 안에서만 겹치지 않음) */
  id: string;
  /** 종류 — 한 종류뿐인 컬렉션은 '' */
  kind: string;
  /** 순서 — 저장 계층이 붙이는 저장 시각(ms) · 같은 시각 안 순번. 메모리판 배열 순서를 DB 에서 되살림 (5.7.1 숨은 상태) */
  at: number;
  seq: number;
  /** 기록 전체 (칸 순서 고정 JSON 글자) */
  body: string;
  projectId?: string;
  taskId?: string;
  who?: string;
  date?: string;
  assigneeId?: string;
  meetingId?: string;
}
export type PmIdxField = 'projectId' | 'taskId' | 'who' | 'date' | 'assigneeId' | 'meetingId';

export const docKeyOf = (r: { kind: string; id: string }) => (r.kind ? `${r.kind}|${r.id}` : r.id);

/** 한 컬렉션을 읽고 쓰는 길 — Appwrite(`pmDbAppwrite`) · 테스트 가짜 DB(`pmDb.fake`)가 같은 모양 */
export interface PmCollApi {
  /** 전부 (100건씩 차례로) */
  list(): Promise<PmRow[]>;
  /** 문서 key 로 몇 건 (고치기 전 내용 비교 — 5.7.3 ①) */
  get(keys: readonly string[]): Promise<PmRow[]>;
  /** 새로 만들기 — 같은 key 가 있으면 `PmExistsError` */
  insert(row: PmRow): Promise<void>;
  /** 있는 문서 고치기 */
  save(row: PmRow): Promise<void>;
  remove(key: string): Promise<void>;
}
export interface PmDb {
  coll(name: string): PmCollApi;
  /** 쓰기 제한(429) 때 기다리기 — 테스트는 바로 넘어감 */
  wait?(ms: number): Promise<void>;
}

export class PmExistsError extends Error {
  constructor(public readonly coll: string, public readonly key: string) { super(`'${coll}/${key}' 문서가 이미 있습니다`); this.name = 'PmExistsError'; }
}
export class PmRateLimitError extends Error {
  /** 다시 써도 되는 시각까지 남은 ms (머리말이 없으면 undefined → 10 → 20 → 40초, pmSync.write) */
  constructor(public readonly resetMs?: number) { super('쓰기 제한 (429)'); this.name = 'PmRateLimitError'; }
}
/** 컬렉션이 없음 (스위치 가드 — 5.7.4) */
export class PmDbMissingError extends Error {
  constructor(public readonly colls: string[]) { super(`PM 저장소 준비 안 됨 (컬렉션 없음: ${colls.join(', ')})`); this.name = 'PmDbMissingError'; }
}

type SnapKey = keyof PmSnapshot;
export interface PmKindDef {
  kind: string;
  field: SnapKey;
  /** 배열이 아니라 객체 1개 (settings · moneyCfg · meta) — 문서 id = kind */
  single?: true;
  /** 기록 id (기본 rec.id, 티켓 = no) */
  idOf?: (rec: Record<string, unknown>) => string;
  /** 읽을 때 모양 확인 · 빈 칸 채우기 (zod 기본값). 없으면 그대로 */
  schema?: ZodTypeAny;
}
export interface PmCollDef {
  name: string;
  kinds: PmKindDef[];
  idx: PmIdxField[];
  /** 읽은 뒤 순서: stamp = 저장 순 · stampDesc = 최근이 앞(이슈 · CR, 메모리판 unshift) · order = 업무 order 칸 */
  sort: 'stamp' | 'stampDesc' | 'order';
  /** 금액 컬렉션 (7장 16 (나) 때 권한만 바꿀 곳) */
  money?: true;
  /** 번호를 새로 받는 문서 — insert 가 거부되면 다시 읽고 다음 번호로 (최대 3번) */
  numbered?: true;
}

const K = (kind: string, field: SnapKey, schema?: ZodTypeAny, extra: Partial<PmKindDef> = {}): PmKindDef => ({ kind, field, schema, ...extra });
const one = (field: SnapKey, schema?: ZodTypeAny, extra: Partial<PmKindDef> = {}) => [K('', field, schema, extra)];

/**
 * 23개. **배열 순서 = 쓰는 순서** (새로 만들기 · 고치기는 이 순서, 지우기는 거꾸로 — 사업 문서가 맨 먼저 만들어지고 맨 나중에 지워짐, 5.7.2).
 * 변경 이력(pmChangeLogs)은 저장 계층이 따로 맨 끝에 씀.
 */
export const PM_COLLS: readonly PmCollDef[] = [
  { name: 'pmProjects', kinds: one('projects', pmProjectSchema), idx: [], sort: 'stamp' },
  { name: 'pmMaster', kinds: [K('code', 'codes', pmCodeSchema), K('org', 'orgs', pmOrgSchema), K('std', 'stdTasks', pmStdTaskSchema), K('template', 'templates', pmTemplateSchema)], idx: [], sort: 'stamp' },
  { name: 'pmTasks', kinds: one('tasks', pmTaskSchema), idx: ['projectId'], sort: 'order' },
  { name: 'pmTaskFunctions', kinds: one('functions', pmTaskFunctionsSchema), idx: ['projectId'], sort: 'stamp' },
  { name: 'pmSubtasks', kinds: one('subtasks', pmSubtaskSchema), idx: ['taskId', 'assigneeId'], sort: 'stamp' },
  { name: 'pmTickets', kinds: one('tickets', pmTicketSchema, { idOf: (r) => String(r.no) }), idx: ['projectId', 'taskId', 'assigneeId'], sort: 'stamp', numbered: true },
  { name: 'pmBaselines', kinds: one('baselines', pmBaselineSchema), idx: [], sort: 'stamp' },
  { name: 'pmIssues', kinds: one('issues', pmIssueSchema), idx: ['projectId'], sort: 'stampDesc', numbered: true },
  { name: 'pmChangeRequests', kinds: one('crs', pmChangeRequestSchema), idx: ['projectId'], sort: 'stampDesc', numbered: true },
  { name: 'pmMeetings', kinds: one('meetings', pmMeetingSchema), idx: ['projectId'], sort: 'stamp' },
  { name: 'pmActions', kinds: one('actions', pmActionSchema), idx: ['projectId', 'meetingId'], sort: 'stamp' },
  { name: 'pmReports', kinds: one('reports', pmReportSchema), idx: ['projectId'], sort: 'stamp' },
  { name: 'pmGovRecords', kinds: one('gov', pmGovRecordSchema), idx: ['projectId'], sort: 'stamp' },
  { name: 'pmAgreements', kinds: one('agreements', pmAgreementChangeSchema), idx: ['projectId'], sort: 'stamp' },
  {
    name: 'pmMarks',
    kinds: [K('done', 'done', pmTaskDoneSchema), K('msOk', 'msOk', pmMilestoneOkSchema), K('doc', 'docs', pmDocSchema), K('tlink', 'tlinks'), K('weekCheck', 'weekChecks', pmWeekCheckSchema),
      K('planCheck', 'planChecks', pmPlanCheckSchema), K('govLink', 'govLinks', pmGovLinkSchema), K('settings', 'settings', undefined, { single: true }), K('meta', 'baseDate', undefined, { single: true })],
    idx: ['projectId'], sort: 'stamp',
  },
  { name: 'pmPersonal', kinds: [K('later', 'later', pmLaterSchema), K('seen', 'seen'), K('fav', 'favs'), K('planRep', 'planReps', pmPlanRepSchema), K('updReq', 'updReq', pmUpdRequestSchema)], idx: ['who'], sort: 'stamp' },
  { name: 'pmPlanDays', kinds: one('planDays', pmPlanDaySchema), idx: ['who', 'date'], sort: 'stamp' },
  { name: 'pmPdfDrafts', kinds: one('pdfDrafts', pmPdfDraftSchema), idx: ['who'], sort: 'stamp' },
  { name: 'pmKpiRecords', kinds: [K('def', 'kpiDefs'), K('meas', 'kpiMeas'), K('ai', 'aiMeas')], idx: ['projectId'], sort: 'stamp' },
  { name: 'pmMoney', kinds: [K('cfg', 'moneyCfg', pmMoneyCfgSchema, { single: true }), K('rule', 'fundRules', pmFundRuleSchema), K('fund', 'funds', pmFundSchema), K('pay', 'pays', pmPaySchema), K('cost', 'costs', pmCostSchema), K('oh', 'oh', pmOhSchema)], idx: ['projectId'], sort: 'stamp', money: true },
  { name: 'pmMoneyItems', kinds: one('items', pmItemSchema), idx: [], sort: 'stamp', money: true },
  { name: 'pmMoneyContracts', kinds: one('contracts', pmContractSchema), idx: ['projectId'], sort: 'stamp', money: true },
  { name: 'pmChangeLogs', kinds: one('logs', pmChangeLogSchema), idx: ['projectId', 'date'], sort: 'stamp' },
];
export const LOG_COLL = 'pmChangeLogs';
/** DB 에 넣지 않는 스냅숏 칸 — 계획서 내장 데이터(코드에 묶음) · meta 로 가는 것 (5.7.1, lastProjectNo = 결정 (가)) */
export const PM_NOT_STORED: readonly SnapKey[] = ['plans', 'planFunctions', 'sourceVersion', 'lastProjectNo'];

/** 저장 계층만 쓰는 body 칸 — 이 코드가 모르는 칸으로 보지 않음 (N3 지키기에서 뺌) */
export const RESERVED_BODY_KEYS = ['rekeyFrom'] as const;

// ── body 글자 ─────────────────────────────────────

/** 칸 순서 고정 JSON — 맨 위 칸은 이름 순 (같은 기록이면 늘 같은 글자 → 내용 비교 5.7.3 ①) */
export function bodyOf(rec: unknown): string {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return JSON.stringify(rec);
  const o = rec as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) if (o[k] !== undefined) out[k] = o[k];
  return JSON.stringify(out);
}

/** 읽은 body → 기록. 모양이 틀리면 null (읽지 못한 기록 — 처음 열 때 점검에 셈) */
export function parseBody(kd: PmKindDef, body: string): { rec: Record<string, unknown>; raw: Record<string, unknown> } | null {
  let raw: unknown;
  try { raw = JSON.parse(body); } catch { return null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const clean = { ...r };
  for (const k of RESERVED_BODY_KEYS) delete clean[k];
  if (!kd.schema) return { rec: clean, raw: r };
  const p = kd.schema.safeParse(clean);
  return p.success ? { rec: p.data as Record<string, unknown>, raw: r } : null;
}

/**
 * N3 — 이 코드가 모르는 맨 위 칸 (배포로 칸이 늘어난 뒤 옛 탭이 읽은 경우). zod `z.object` 는 모르는 칸을 버리므로,
 * 고쳐 쓸 때 DB 에서 읽은 값을 그대로 붙여 새 칸이 지워지지 않게 한다. 줄 목록 안(티켓 이력 등)의 칸은 못 지킴.
 */
export function unknownKeys(raw: Record<string, unknown>, rec: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) if (!(k in rec) && !(RESERVED_BODY_KEYS as readonly string[]).includes(k)) out[k] = raw[k];
  return out;
}

// ── 스냅숏 ↔ 기록 ────────────────────────────────

export interface PmDocRec { key: string; id: string; kind: string; rec: Record<string, unknown> }

/** 스냅숏 → 컬렉션 · 종류별 기록 (배열 순서 그대로) */
export function recsOf(_def: PmCollDef, kd: PmKindDef, snap: PmSnapshot): PmDocRec[] {
  if (kd.kind === 'meta') {
    const rec = { id: 'meta', baseDate: snap.baseDate, sourceVersion: snap.sourceVersion, lastProjectNo: snap.lastProjectNo, stdSeeded: true };
    return [{ key: docKeyOf({ kind: 'meta', id: 'meta' }), id: 'meta', kind: 'meta', rec }];
  }
  if (kd.single) {
    const rec = { ...(snap[kd.field] as unknown as Record<string, unknown>) };
    return [{ key: docKeyOf({ kind: kd.kind, id: kd.kind }), id: kd.kind, kind: kd.kind, rec }];
  }
  const list = snap[kd.field] as unknown as Array<Record<string, unknown>>;
  return list.map((rec) => {
    const id = kd.idOf ? kd.idOf(rec) : String(rec.id);
    return { key: docKeyOf({ kind: kd.kind, id }), id, kind: kd.kind, rec };
  });
}

/** 찾는 칸 (body 에서 베낌). projectId 가 없는 기록은 id 의 '사업|…' 앞부분 */
export function idxOf(def: PmCollDef, _kd: PmKindDef, d: PmDocRec): Partial<Record<PmIdxField, string>> {
  const r = d.rec;
  const out: Partial<Record<PmIdxField, string>> = {};
  for (const f of def.idx) {
    let v = r[f];
    if (f === 'projectId' && typeof v !== 'string') v = d.id.includes('|') ? d.id.split('|')[0] : '';
    if (f === 'who' && typeof v !== 'string' && def.name === 'pmPersonal') v = d.id;
    out[f] = typeof v === 'string' ? v : '';
  }
  return out;
}

/** 기록 → DB 한 줄 */
export function rowOf(def: PmCollDef, kd: PmKindDef, d: PmDocRec, at: number, seq: number, body = bodyOf(d.rec)): PmRow {
  return { id: d.id, kind: d.kind, at, seq, body, ...idxOf(def, kd, d) };
}

/** 7-5 옮기기 · 테스트 가짜 DB 채우기 — 스냅숏 전체를 줄로 (순서 = 배열 순서: at 0, seq 0,1,2 …) */
export function snapshotRows(snap: PmSnapshot): Map<string, PmRow[]> {
  const out = new Map<string, PmRow[]>();
  for (const def of PM_COLLS) {
    const rows: PmRow[] = [];
    for (const kd of def.kinds) recsOf(def, kd, snap).forEach((d, i) => rows.push(rowOf(def, kd, d, 0, i)));
    out.set(def.name, rows);
  }
  return out;
}

export const kindDef = (def: PmCollDef, kind: string) => def.kinds.find((k) => k.kind === kind);
export const stampCmp = (a: { at: number; seq: number }, b: { at: number; seq: number }) => a.at - b.at || a.seq - b.seq;
