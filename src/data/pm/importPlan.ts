import {
  pmProjectSchema, pmSubtaskSchema, pmTaskFunctionsSchema, pmTaskSchema,
  type PmProject, type PmSubtask, type PmTask,
} from '@/domain/pm/schema';
import { PM_TICKET_PRIOS, PM_TICKET_STATUSES, PM_TICKET_TYPES, pmTicketSchema, ticketType, type PmTicket } from '@/domain/pm/ticket';
import { seedFunctions, seedProjects, seedSubtasks, seedTasks } from './seed';

type DemoTicket = NonNullable<DemoState['tickets']>[number];
const pick = <T extends string>(v: unknown, list: readonly T[], dflt: T): T => (list.includes(v as T) ? (v as T) : dflt);

/** 데모 티켓 → `pmTickets` (사람 이름 → 사용자 ID). 예전 WBS 번호면 업무 연결 없이 '옛 업무' */
export function legacyTicket(t: DemoTicket, taskIds: ReadonlySet<string>, subIds: ReadonlySet<string>, idOf: (name: unknown) => string): PmTicket {
  const linked = taskIds.has(t.key);
  const s = (v: unknown) => (v == null ? '' : String(v));
  return {
    no: t.no, projectId: t.k, taskId: linked ? t.key : '', subtaskId: t.sub && subIds.has(t.sub) ? t.sub : '', legacyKey: linked ? '' : t.key,
    code: linked ? t.wbs : '', title: t.title, parent: s(t.parent), output: s(t.out), stage: s(t.stage),
    type: pick(t.type, PM_TICKET_TYPES, ticketType(s(t.stage))), approverId: idOf(t.pm), reviewerId: idOf(t.reviewer), reviewOk: !!t.revOk,
    assigneeId: idOf(t.assignee), watcherIds: (t.watchers ?? []).map(idOf).filter(Boolean), prio: pick(t.prio, PM_TICKET_PRIOS, '보통'),
    start: s(t.start), due: s(t.due), status: pick(t.status, PM_TICKET_STATUSES, '발행'), prog: Math.max(0, Math.min(100, Number(t.prog) || 0)),
    created: s(t.created), issuerId: idOf(t.issuer), memo: s(t.memo),
    files: Array.isArray(t.files) ? (t.files as Array<{ name?: string; d?: string; who?: string }>).map((f) => ({ name: s(f.name), date: s(f.d), by: idOf(f.who) })) : [],
    taskChange: s(t.wbsChg),
    hist: (t.hist ?? []).map((h) => ({ date: s(h.d), by: idOf(h.who) || (h.who === '시스템' ? 'system' : ''), text: s(h.txt), ...((h as { c?: number }).c ? { comment: true } : {}) })),
  };
}

/**
 * 옮기기 미리보기(dry-run) — DB에 쓰지 않고 "무엇이 몇 건 들어갈지" 계산만 한다.
 * 원본 = 데모 내장 데이터(seed) + NAS `state.json` (§4.1 우선순위). 사람 = 그룹웨어 사용자(읽기만).
 * 이 파일은 순수 함수만 — 파일 읽기·DB 읽기는 `scripts/pm-import.ts` 가 한다.
 * ([[2026-11-24-pms-port-design]] §4·§4.1·§4.4·5장 1.5단계)
 */

/** 그룹웨어 사용자 (짝짓기에 필요한 칸만) */
export interface GwUserLite {
  id: string;
  name: string;
  dept: string;
  position: string;
  status: string;
  resignedAt?: string;
}

/** `state.json` 의 `state` — 미리보기에 쓰는 칸만 느슨하게 */
export interface DemoState {
  sites?: Array<Record<string, unknown> & { k: string }>;
  users?: Array<{ id: string; name: string; title?: string; role?: string; org?: string; fromWbs?: boolean }>;
  tickets?: Array<Record<string, unknown> & {
    no: string; key: string; sub?: string; k: string; wbs: string; title: string; parent?: string;
    pm?: string; assignee?: string; issuer?: string; watchers?: string[]; status?: string;
    hist?: Array<{ d?: string; who?: string; txt?: string }>;
  }>;
  subs?: Record<string, Array<{ id: string; txt: string; who?: string; due?: string; est?: number; done?: boolean; by?: string; d?: string; dd?: string; ddBy?: string }>>;
  plan?: Record<string, Record<string, unknown[]>>;
  pdfDraft?: Record<string, Record<string, unknown>>;
  baselines?: Record<string, { d?: string; label?: string; map?: Record<string, unknown> }>;
  wbsLog?: unknown[];
  wbsImport?: unknown;
  [k: string]: unknown;
}

export interface PdfInput {
  /** 사업 키 → 계획서 파일 이름 (데모 PLAN_LINK) */
  links: Record<string, string>;
  /** `사업계획서/` 폴더에 실제로 있는 파일 이름 */
  files: string[];
}

export type PersonKind = '내부' | '도입기업 담당' | '협력사';
export type MatchResult = '찾음' | '없음' | '동명이인' | '퇴사·미사용';

export interface PersonRow {
  name: string;
  title: string;
  role: string;
  org: string;
  kind: PersonKind;
  /** 내부만 짝짓기. 외부는 이름 글자로 (§4.4) */
  match: MatchResult | '안 함(이름 글자)';
  userId: string;
  gwDept: string;
  /** 옮길 기록에서 이 이름이 쓰인 횟수 */
  refs: number;
}

export interface CountRow { collection: string; count: number; source: string; note: string }
export interface BrokenRow {
  kind: '티켓' | '세부 작업';
  id: string;
  oldKey: string;
  title: string;
  status: string;
  /** 참고 후보 (자동 연결 안 함) */
  candidate: string;
  candidateScore: number;
}
export interface LeftRow { key: string; count: string; reason: string; when: string }
export interface ProjectDiffRow { k: string; company: string; inState: boolean; diffs: string[]; stateOnly: string[] }
export interface PdfRow { k: string; company: string; file: string; found: boolean }

export interface ImportPreview {
  counts: CountRow[];
  people: PersonRow[];
  unknownNames: string[];
  broken: BrokenRow[];
  projects: ProjectDiffRow[];
  left: LeftRow[];
  pdf: PdfRow[];
  schemaErrors: string[];
  problems: string[];
}

// ── 사람 ─────────────────────────────────────────────

/** "박명규 부장" → "박명규" (데모는 이름+직급 한 글자열, §4.4) */
export const bareName = (v: unknown) => String(v ?? '').trim().split(/\s+/)[0] ?? '';

export function personKind(u: { role?: string; org?: string }): PersonKind {
  if (u.role === '도입기업 담당' || /\(도입기업\)/.test(u.org ?? '')) return '도입기업 담당';
  if (u.role === '협력사') return '협력사';
  return '내부';
}

export function matchUser(name: string, users: readonly GwUserLite[]): { match: MatchResult; user?: GwUserLite } {
  const same = users.filter((u) => u.name.trim() === name);
  const active = same.filter((u) => u.status === '사용' && !u.resignedAt);
  if (active.length === 1) return { match: '찾음', user: active[0] };
  if (active.length > 1) return { match: '동명이인' };
  if (same.length) return { match: '퇴사·미사용', user: same[0] };
  return { match: '없음' };
}

/** 옮길 기록(티켓·세부 작업·사업 PM·업무 PM)에 나오는 이름과 횟수 */
function referencedNames(state: DemoState, projects: readonly PmProject[], tasks: readonly PmTask[]): Map<string, number> {
  const m = new Map<string, number>();
  const add = (v: unknown) => { const n = bareName(v); if (n) m.set(n, (m.get(n) ?? 0) + 1); };
  for (const t of state.tickets ?? []) {
    [t.pm, t.assignee, t.issuer, ...(t.watchers ?? []), ...(t.hist ?? []).map((h) => h.who)].forEach(add);
  }
  for (const list of Object.values(state.subs ?? {})) for (const s of list) [s.who, s.by, s.ddBy].forEach(add);
  projects.forEach((p) => add(p.pmName));
  tasks.forEach((t) => add(t.pmName));
  return m;
}

// ── 연결 끊김 후보 (참고만) ───────────────────────────

const bigrams = (s: string) => {
  const t = s.replace(/[\s\[\]()·/,.\-—_]+/g, '');
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
};
function similarity(a: string, b: string): number {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  A.forEach((x) => { if (B.has(x)) hit++; });
  return hit / Math.min(A.size, B.size);
}
function bestTask(projectId: string, text: string, tasks: readonly PmTask[]): { label: string; score: number } {
  let best: PmTask | undefined; let score = 0;
  for (const t of tasks) {
    if (t.projectId !== projectId) continue;
    const s = similarity(text, `${t.name} ${t.group}`);
    if (s > score) { score = s; best = t; }
  }
  return best && score >= 0.3 ? { label: `${best.code} ${best.name}`, score: Math.round(score * 100) / 100 } : { label: '', score: 0 };
}

// ── 미리보기 ───────────────────────────────────────────

const SITE_SHARED = ['track', 'biz', 'co', 'sup', 'no', 'org', 'pm', 'start', 'end', 'summary'] as const;
const SITE_SKIP = new Set(['id', 'k', ...SITE_SHARED]);
const isEmpty = (v: unknown) => v === '' || v == null || (Array.isArray(v) && v.length === 0);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 1.5단계에서 칸을 정하지 않은(뒤 단계) `state.json` 항목 — 건수·이유·언제 */
const LATER: Record<string, { reason: string; when: string }> = {
  orgs: { reason: '기업·기관 목록 (도입·공급·운영기관). 칸 설계(3.2)에 아직 컬렉션 없음', when: '6단계 기준정보' },
  depts: { reason: '데모 부서 — 그룹웨어 조직도를 쓰므로 안 옮김 (비교만)', when: '옮기지 않음' },
  codes: { reason: '사업 구분·단계·예전 WBS 업무 템플릿(옛 번호 기준)', when: '6단계 기준정보' },
  templates: { reason: '업무 템플릿 — 예전 통합 WBS 사업을 기준으로 함', when: '6단계 기준정보' },
  gates: { reason: '마일스톤 승인 관문 기준', when: '2단계 티켓(검토 흐름) 또는 4단계' },
  protocols: { reason: '설비 통신 프로토콜 기준표', when: '6단계 기준정보' },
  money: { reason: '손익: 설정·지원 기준·계약·비용·입금·재원', when: '6단계 사업·손익' },
  planApplied: { reason: '계획서 적용 기록 (날짜만)', when: '3단계 사업별 화면' },
};

/** 화면 상태 등 옮기지 않는 칸 */
const DROP: Record<string, string> = {
  plan: '업무계획 — 옮기지 않고 새로 시작 (3.5.2 6번)',
  pdfDraft: '일일 업무보고 초안 — 업무계획과 같이 새로 시작',
  baselines: '예전 WBS 번호 기준선 — 옮길 때 새로 만듦 (4.1)',
  seen: '화면 알림 읽음 표시', descOn: '화면 설명 펼침', extInferred: '외부 사람 자동 추정 날짜',
  partnerSet: '협력사 지정 날짜', orgSeed: '시드 버전', orgChartSeed: '시드 버전', carryFrom: '업무계획 이월 날짜',
  tkSeq: '티켓 번호 순번 — 티켓 번호에서 다시 계산', seq: '순번', schema: '형식 번호', stageType: '빈 값', msOk: '빈 값',
  integ: '외부 연동 켜짐 표시(모두 꺼짐)', integCfg: '빈 값', loadMax: '부하 상한 설정값', alloc: '빈 값',
  gateTypes: '관문 종류 이름', wbsImport: '예전 WBS 수정본 — 버림 (4.1)',
  // 6-7: 데모 사업비 집행 화면(siteCost)은 11/9 메뉴 정리로 없앰(정산은 RCMS) — 쓰는 화면이 없음 (설계 5.6.7)
  budgets: '사업비 비목 예산 — 계획서 4.1 총괄로 자동 채운 값(11/24 받은 state.json 7개 사업 49칸 모두 같음), 쓰는 화면 없음 (5.6.7)',
  spends: '사업비 집행 — 쓰는 화면 없음(데모 11/9 없앰, 5.6.7)',
};

export function buildImportPreview(state: DemoState, users: readonly GwUserLite[], pdf: PdfInput, today: string): ImportPreview {
  const problems: string[] = [];
  const schemaErrors: string[] = [];

  // 1) 내장 데이터 → 사업·업무·세부 기능·FP 세부 작업
  const projects = seedProjects();
  const tasks = seedTasks();
  const fns = seedFunctions();
  const fpSubs = seedSubtasks(fns, today);
  const taskIds = new Set(tasks.map((t) => t.id));

  // 2) 사람
  const refs = referencedNames(state, projects, tasks);
  const demoUsers = state.users ?? [];
  const people: PersonRow[] = demoUsers.map((u) => {
    const kind = personKind(u);
    const base = { name: u.name, title: u.title ?? '', role: u.role ?? '', org: u.org ?? '', kind, refs: refs.get(u.name) ?? 0 };
    if (kind !== '내부') return { ...base, match: '안 함(이름 글자)' as const, userId: '', gwDept: '' };
    const r = matchUser(u.name, users);
    return { ...base, match: r.match, userId: r.match === '찾음' ? r.user!.id : '', gwDept: r.user?.dept ?? '' };
  });
  const known = new Set(demoUsers.map((u) => u.name));
  const unknownNames = [...refs.keys()].filter((n) => !known.has(n)).sort();
  const idOf = (name: unknown) => people.find((p) => p.name === bareName(name) && p.match === '찾음')?.userId ?? '';

  // 사업 PM → 사용자 ID
  for (const p of projects) p.pmUserId = idOf(p.pmName);

  // 3) state.json 세부 작업 → pmSubtasks (예전 WBS 번호면 연결 끊김)
  const broken: BrokenRow[] = [];
  const stateSubs: PmSubtask[] = [];
  for (const [key, list] of Object.entries(state.subs ?? {})) {
    list.forEach((s, i) => {
      const row: PmSubtask = {
        id: s.id, taskId: key, text: s.txt, assigneeId: idOf(s.who), due: s.due ?? '', estHours: Number(s.est) || 0,
        done: !!s.done, doneDate: s.dd ?? '', doneBy: idOf(s.ddBy), memo: '', createdBy: idOf(s.by), createdDate: s.d ?? '', fromFp: false, order: i,
        // 예전 WBS 번호면 '옛 업무' 기록으로만 (11/24 사용자 — 다시 잇는 화면 없음)
        legacyKey: taskIds.has(key) ? '' : key,
      };
      stateSubs.push(row);
      if (!taskIds.has(key)) {
        const c = bestTask(key.split('|')[0], s.txt, tasks);
        broken.push({ kind: '세부 작업', id: s.id, oldKey: key, title: s.txt, status: s.done ? '완료' : '미완료', candidate: c.label, candidateScore: c.score });
      }
    });
  }
  const emptySubKeys = Object.entries(state.subs ?? {}).filter(([, l]) => !l.length).map(([k]) => k);
  if (emptySubKeys.length) problems.push(`세부 작업 목록이 빈 업무 ${emptySubKeys.length}개(${emptySubKeys.join(', ')}) — 옮길 것 없음 (지운 흔적)`);

  // 4) 티켓 → pmTickets. 예전 WBS 번호면 taskId 없이 legacyKey(옛 업무)만
  const subIds = new Set(stateSubs.map((s) => s.id));
  const tickets: PmTicket[] = (state.tickets ?? []).map((t) => legacyTicket(t, taskIds, subIds, idOf));
  for (const t of state.tickets ?? []) {
    if (!taskIds.has(t.key)) {
      const c = bestTask(t.k, `${t.title} ${t.parent ?? ''}`, tasks);
      broken.push({ kind: '티켓', id: t.no, oldKey: t.key, title: t.title, status: String(t.status ?? ''), candidate: c.label, candidateScore: c.score });
    }
    if (t.sub && !subIds.has(t.sub)) problems.push(`티켓 ${t.no}: 묶인 세부 작업(${t.sub})이 state.json 에 없음 — 세부 작업이 지워진 티켓`);
    for (const f of ['start', 'due', 'created'] as const) {
      const v = t[f];
      if (!isEmpty(v) && !DATE.test(String(v))) problems.push(`티켓 ${t.no}: ${f} 날짜 형식 아님 (${String(v)})`);
    }
  }

  // 5) 칸 설계 확인 — 지금 있는 zod 모양에 넣어 본다
  const check = <T,>(label: string, rows: readonly T[], schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } } }, id: (r: T) => string) => {
    for (const r of rows) {
      const res = schema.safeParse(r);
      if (!res.success) schemaErrors.push(`${label} ${id(r)}: ${res.error!.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(' / ')}`);
    }
  };
  check('사업', projects, pmProjectSchema, (r) => r.id);
  check('업무', tasks, pmTaskSchema, (r) => r.id);
  check('세부 기능', fns, pmTaskFunctionsSchema, (r) => r.id);
  check('세부 작업', [...fpSubs, ...stateSubs], pmSubtaskSchema, (r) => r.id);
  check('티켓', tickets, pmTicketSchema, (r) => r.no);

  // 6) 사업: 내장 데이터 vs state.json sites
  const sites = state.sites ?? [];
  const embedded = seedProjects();
  const projectRows: ProjectDiffRow[] = embedded.map((p) => {
    const s = sites.find((x) => x.k === p.id);
    if (!s) return { k: p.id, company: p.company, inState: false, diffs: [], stateOnly: [] };
    const mine: Record<string, string> = { track: p.track, biz: p.biz, co: p.company, sup: p.supplier, no: p.bizNo, org: p.org, pm: p.pmName, start: p.start, end: p.end, summary: p.summary };
    const diffs = SITE_SHARED.filter((f) => (mine[f] ?? '') !== String(s[f] ?? '')).map((f) => `${f}: 내장 "${mine[f]}" / state "${String(s[f] ?? '')}"`);
    const stateOnly = Object.entries(s).filter(([f, v]) => !SITE_SKIP.has(f) && !isEmpty(v)).map(([f, v]) => `${f}=${String(v)}`);
    return { k: p.id, company: p.company, inState: true, diffs, stateOnly };
  });
  const extraSites = sites.filter((s) => !embedded.some((p) => p.id === s.k)).map((s) => s.k);
  if (extraSites.length) problems.push(`state.json 에만 있는 사업 ${extraSites.join(', ')}`);
  if (projectRows.some((r) => r.stateOnly.length)) {
    problems.push('state.json 사업에만 있는 칸(업종·지역·총사업비·지원금·색) → `pmProjects` 칸 설계에 없음. 사업 화면 단계(3·6단계)에서 칸을 더할지 정해야 함');
  }

  // 7) 계획서 PDF 대조 (폴더 기준, 4.3)
  const pdfRows: PdfRow[] = projects.map((p) => {
    const file = pdf.links[p.id] ?? '';
    return { k: p.id, company: p.company, file, found: !!file && pdf.files.includes(file) };
  });

  // 8) 옮기지 않거나 뒤 단계로 미루는 것
  const count = (v: unknown) => (Array.isArray(v) ? `${v.length}` : v && typeof v === 'object' ? `${Object.keys(v).length}개 묶음` : isEmpty(v) ? '0' : '값 1개');
  const left: LeftRow[] = [];
  for (const [k, v] of Object.entries(state)) {
    if (['sites', 'users', 'tickets', 'subs'].includes(k)) continue;
    if (LATER[k]) left.push({ key: k, count: count(v), ...LATER[k] });
    else if (DROP[k]) left.push({ key: k, count: count(v), reason: DROP[k], when: '옮기지 않음' });
    else if (!isEmpty(v) && !(typeof v === 'object' && v && Object.keys(v).length === 0)) left.push({ key: k, count: count(v), reason: '분류 안 됨 — 확인 필요', when: '?' });
    else left.push({ key: k, count: '0', reason: '빈 값 — 아직 기록 없음', when: '그 메뉴 단계에서 칸만 만듦' });
  }
  const planN = Object.values(state.plan ?? {}).reduce((a, d) => a + Object.values(d).reduce((b, l) => b + (Array.isArray(l) ? l.length : 0), 0), 0);

  // 9) 건수
  const projectsWithTasks = new Set(tasks.map((t) => t.projectId));
  const counts: CountRow[] = [
    { collection: 'pmProjects', count: projects.length, source: '내장 데이터', note: `사업 13 중 P1 에이스메디칼 제외(DROP_K). 업무 있는 사업 ${projectsWithTasks.size}개` },
    { collection: 'pmTasks', count: tasks.length, source: '내장 데이터', note: '담당·날짜 비어 있음 (가짜 값 안 넣음)' },
    { collection: 'pmTaskFunctions', count: fns.length, source: '내장 데이터', note: `세부 기능 ${fns.reduce((a, f) => a + f.items.length, 0)}줄` },
    { collection: 'pmSubtasks', count: fpSubs.length + stateSubs.length, source: '내장(FP) + state.json', note: `FP 신규·변경 미리 넣기 ${fpSubs.length} + 사람이 만든 것 ${stateSubs.length}(전부 연결 끊김)` },
    { collection: 'pmTickets', count: tickets.length, source: 'state.json', note: `옛 업무(예전 WBS 번호) ${tickets.filter((x) => x.legacyKey).length} — 업무 연결 없이 기록으로` },
    { collection: 'pmBaselines', count: projectsWithTasks.size, source: '새로 만듦', note: `"최초 계획 · 옮긴 날" — 업무 있는 사업만. 예전 기준선 ${Object.keys(state.baselines ?? {}).length}개는 안 옮김` },
    { collection: 'pmChangeLogs', count: (state.wbsLog ?? []).length, source: 'state.json', note: '예전 변경 이력 0건' },
    { collection: 'pmDailyPlans', count: 0, source: '—', note: `업무계획 ${planN}건은 새로 시작 (옮기지 않음)` },
  ];

  if (unknownNames.length) problems.push(`기록에 나오지만 데모 사용자 목록에 없는 이름: ${unknownNames.join(', ')}`);
  const needUser = people.filter((p) => p.kind === '내부' && p.match !== '찾음');
  if (needUser.length) problems.push(`내부 직원인데 그룹웨어 사용자와 짝이 안 된 사람 ${needUser.length}명: ${needUser.map((p) => `${p.name}(${p.match})`).join(', ')}`);
  const missPdf = pdfRows.filter((r) => !r.found);
  if (missPdf.length) problems.push(`계획서 PDF 없음: ${missPdf.map((r) => `${r.k} ${r.company}${r.file ? '' : '(지정 없음)'}`).join(', ')}`);

  return { counts, people, unknownNames, broken, projects: projectRows, left, pdf: pdfRows, schemaErrors, problems };
}
