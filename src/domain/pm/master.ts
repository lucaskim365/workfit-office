import { addDays, diffDays } from './rules';
import { isFP, isPre } from './site';
import { PM_ORG_TYPES, pmTaskSchema, type PmCode, type PmOrg, type PmProject, type PmStdTask, type PmTask, type PmTemplate } from './schema';

/**
 * 기준정보 — 사업 · 기업/기관 · 코드 · 표준 업무 · 템플릿 (데모 ensureMaster 3647 · seedTemplates 2144 · applyTemplate 2905).
 * 처음 켤 때 사업 · 업무 목록에서 자동으로 만들고(auto), 그 뒤엔 사람이 기준정보 화면에서 고친다.
 */

export const ORG_FIELD: Record<PmOrg['type'], 'company' | 'supplier' | 'org'> = { 도입기업: 'company', 공급기업: 'supplier', 운영기관: 'org' };
/** 화면 계산에 쓰는 상태 — 이름 변경 · 삭제 불가 (ST_SYS) */
export const ST_SYS = ['계획', '진행중', '완료'] as const;
export const INDUSTRIES = ['', '식품', '금속가공', '전자부품', '사출성형', '자동차부품', '화학', '섬유', '기계장비', '시멘트·건자재', '의료기기', '물류', '기타'] as const;

export interface Master {
  orgs: PmOrg[];
  codes: PmCode[];
  stdTasks: PmStdTask[];
  templates: PmTemplate[];
}

const keyNum = (k: string) => +String(k).replace(/\D/g, '') || 0;
/** 사업을 사업키 번호 순으로 (데모 S.sites 순서) */
export const byKey = <T extends { id: string }>(a: readonly T[]) => [...a].sort((x, y) => keyNum(x.id) - keyNum(y.id));

/**
 * 비어 있는 기준정보를 사업 · 업무 목록에서 채움 (ensureMaster) — 이미 있는 이름은 그대로, 새 이름만 더함.
 * 표준 세부 업무는 처음 한 번만(stdSeeded): 사업구분마다 업무가 가장 많은 사업의 업무 목록 → 이름 정리 → 핵심 업무 보완.
 */
export function deriveMaster(m: Master, projects: readonly PmProject[], tasks: readonly PmTask[], stdSeeded: boolean): { m: Master; added: number } {
  const out: Master = { orgs: [...m.orgs], codes: [...m.codes], stdTasks: [...m.stdTasks], templates: [...m.templates] };
  let n = 0;
  const sites = byKey(projects);
  // 기업 · 기관: 사업의 도입 · 공급 · 운영 이름
  for (const s of sites) for (const ty of PM_ORG_TYPES) {
    const v = (s[ORG_FIELD[ty]] || '').trim();
    if (v && !out.orgs.some((o) => o.type === ty && o.name === v)) {
      const buyer = ty === '도입기업';
      out.orgs.push({ id: `o:${ty}:${v}`, type: ty, name: v, bizRegNo: buyer ? s.bizRegNo : '', ceo: buyer ? s.ceo : '', region: buyer ? s.region : '', contact: '', phone: '', email: '', note: '', auto: true });
      n++;
    }
  }
  // 사업구분 · 트랙
  const codes = (g: PmCode['group']) => out.codes.filter((c) => c.group === g);
  for (const s of sites) if (s.biz && !codes('biz').some((c) => c.name === s.biz)) { out.codes.push(code('biz', `b:${s.biz}`, s.biz, { track: s.track })); n++; }
  // 단계: 사업구분마다 업무 목록에 처음 나온 순 (시작일 빠른 순, 없으면 나온 순)
  const bizOf = new Map(sites.map((s) => [s.id, s.biz]));
  const first = new Map<string, string>();
  for (const t of tasks) {
    const b = bizOf.get(t.projectId);
    if (!b || !t.stage) continue;
    const id = `${b}|${t.stage}`;
    const cur = first.get(id);
    if (cur === undefined || (t.start && t.start < cur)) first.set(id, t.start || '9');
  }
  for (const id of [...first.keys()].sort((a, b) => (first.get(a)! < first.get(b)! ? -1 : first.get(a)! > first.get(b)! ? 1 : 0))) {
    const [b, st] = id.split('|');
    if (!codes('stage').some((c) => c.biz === b && c.name === st)) { out.codes.push(code('stage', `g:${id}`, st, { biz: b, ord: codes('stage').filter((c) => c.biz === b).length + 1 })); n++; }
  }
  if (!stdSeeded) { out.stdTasks.push(...seedStdTasks(sites, tasks, out.codes)); n++; }
  for (const st of [...ST_SYS, ...new Set(tasks.map((t) => t.status).filter(Boolean))]) if (!codes('status').some((c) => c.name === st)) { out.codes.push(code('status', `s:${st}`, st)); n++; }
  if (!out.templates.length) out.templates = seedTemplates(sites, tasks);
  return { m: out, added: n };
}
const code = (group: PmCode['group'], id: string, name: string, x: Partial<PmCode> = {}): PmCode => ({ id, group, name, track: '', biz: '', ord: 0, note: '', auto: true, ...x });

/** 표준 세부 업무 처음 목록 (ensureMaster taskSeeded · taskClean1 · taskFill1) */
function seedStdTasks(sites: readonly PmProject[], tasks: readonly PmTask[], codes: readonly PmCode[]): PmStdTask[] {
  const T: PmStdTask[] = [];
  const best = new Map<string, { k: string; n: number }>();
  for (const s of sites) { const n = tasks.filter((t) => t.projectId === s.id).length; const b = best.get(s.biz); if (s.biz && n && (!b || b.n < n)) best.set(s.biz, { k: s.id, n }); }
  for (const [biz, { k }] of best) {
    const s = sites.find((x) => x.id === k)!;
    const ts = tasks.filter((t) => t.projectId === k && !isFP(t));
    const s0 = s.start || ts.reduce((a, x) => (x.start && x.start < a ? x.start : a), '9999');
    const ord = new Map<string, number>();
    for (const t of [...ts].sort((x, y) => ((x.start || '') < (y.start || '') ? -1 : (x.start || '') > (y.start || '') ? 1 : 0))) {
      ord.set(t.stage, (ord.get(t.stage) ?? 0) + 1);
      T.push({ id: `t:${k}:${t.code}`, biz, stage: t.stage, ord: ord.get(t.stage)!, code: t.code, name: t.name, output: t.output, off: t.start ? diffDays(s0, t.start) : 0, dur: t.start && t.end ? diffDays(t.start, t.end) + 1 : 1, milestone: t.milestone, from: k });
    }
  }
  // 이름 정리 (taskClean1): 원래 사업의 고유 표현 · 진행 메모를 일반 표현으로
  const fix = (x: string) => x.replace(/ 10\.17 알파버전 초기 단계 개발완료/, ' 개발').replace(/ 10\.17 데이터 파이프라인 확인 완료/, '')
    .replace(/3사 프레스 설비/g, '참여기업 대상 설비').replace(/3사 /g, '참여기업 ').replace(/동일·유사 프레스/g, '동일·유사 설비').replace(/\s*\(2026-07 개시·진행중\)/, '');
  for (const x of T) x.name = fix(x.name);
  // 보완 (taskFill1): 제조AI 2종 마일스톤 · 중간점검 대응 업무, 부처협업형 중간점검 날짜 · 인수인계 업무
  const hasBiz = (b: string) => codes.some((c) => c.group === 'biz' && c.name === b);
  const nx = (b: string, st: string) => Math.max(0, ...T.filter((x) => x.biz === b && x.stage === st).map((x) => +x.ord || 0)) + 1;
  const add = (b: string, st: string, c: string, name: string, output: string, off: number, dur: number, ms: boolean) => {
    if (!hasBiz(b) || T.some((x) => x.biz === b && x.name === name)) return;
    T.push({ id: `t:std:${b}:${c}`, biz: b, stage: st, ord: nx(b, st), code: c, name, output, off, dur, milestone: ms, from: 'std' });
  };
  const MS: Record<string, RegExp[]> = {
    제조AI: [/^협약·착수계 제출 및 킥오프/, /기능 및 우선순위 확정/, /인터페이스 상세설계/, /^SAT:/, /최종 학습셋 동결/, /결함조치 및 재시험/, /최종검수/, /^완료보고·최종점검 대응/],
    '제조AI 특화 물류': [/^협약·착수계 제출 및 킥오프/, /보안 기능 확정$/, /스트리밍 상세설계$/, /수동복구 현장시험$/, /결함조치·재시험$/, /최종검수$/, /완료보고/],
  };
  for (const [b, L] of Object.entries(MS)) for (const x of T) if (x.biz === b && !/협약 이전/.test(x.stage) && !x.milestone && L.some((re) => re.test(x.name))) x.milestone = true;
  add('제조AI', '프로젝트관리', '1.7', '중간보고서 작성 · 중간점검 대응', '중간보고서 · 중간점검 대응자료', 76, 14, true);
  add('제조AI 특화 물류', '프로젝트관리', '1.8', '중간보고서 작성 · 중간점검 대응', '중간보고서 · 중간점검 대응자료', 76, 14, true);
  for (const x of T) if (x.biz === '부처협업형(산업보안)' && x.name === '중간점검 산출물 작성' && !x.off) { x.off = 76; x.dur = 14; x.milestone = true; }
  add('부처협업형(산업보안)', '교육·운영·완료', '7.7', '시스템 인수인계서 · 기술임치 제출', '인수인계서 · 기술임치 증빙', 271, 3, false);
  return T;
}

/** 템플릿 처음 목록 (seedTemplates) — 사업구분마다 업무가 가장 많은 사업 */
export function seedTemplates(sites: readonly PmProject[], tasks: readonly PmTask[]): PmTemplate[] {
  const by = new Map<string, { k: string; n: number }>();
  for (const s of sites) { const n = tasks.filter((t) => t.projectId === s.id).length; const b = by.get(s.biz); if (n && s.biz && (!b || b.n < n)) by.set(s.biz, { k: s.id, n }); }
  return [...by].map(([biz, v], i) => ({ id: `T${i + 1}`, name: `${biz} 표준`, baseId: v.k, desc: `${v.k} 업무 목록 구조 기준` }));
}

// ── 업무 목록 만들기 (사업 등록 · 템플릿 적용) ─────────────

export interface TplTask { stage: string; code: string; name: string; output: string; assigneeIds: string[]; off: number; dur: number; milestone: boolean }
/** 표준 세부 업무 (사업구분 › 단계 순서) */
export function stdTplTasks(m: Master, biz: string): TplTask[] {
  const stOrd = (st: string) => m.codes.find((c) => c.group === 'stage' && c.biz === biz && c.name === st)?.ord || 99;
  return m.stdTasks.filter((x) => x.biz === biz).sort((a, b) => stOrd(a.stage) - stOrd(b.stage) || a.ord - b.ord)
    .map((x) => ({ stage: x.stage, code: x.code || `${stOrd(x.stage)}.${x.ord}`, name: x.name, output: x.output, assigneeIds: [], off: +x.off || 0, dur: +x.dur || 1, milestone: x.milestone }));
}
/** 템플릿 = 기준 사업 업무 (tplTasks) — 날짜는 기준 사업 시작일부터 며칠 */
export function baseTplTasks(base: PmProject | undefined, tasks: readonly PmTask[]): TplTask[] {
  if (!base) return [];
  const ts = tasks.filter((t) => t.projectId === base.id);
  const s0 = base.start || ts.reduce((a, x) => (x.start && x.start < a ? x.start : a), '9999');
  return ts.map((x) => ({ stage: x.stage, code: x.code, name: x.name, output: x.output, assigneeIds: x.assigneeIds, off: x.start ? diffDays(s0, x.start) : 0, dur: x.start && x.end ? diffDays(x.start, x.end) + 1 : 1, milestone: x.milestone }));
}
/** 템플릿 일정을 협약 기간에 맞춤 (fitDays): 앞 구간(최대 90일)은 그대로, 그 뒤는 협약 종료일까지 늘리거나 줄임 */
export function fitDays(ts: readonly TplTask[], start: string, end: string): TplTask[] {
  const D = start && end ? diffDays(start, end) : 0;
  const span = Math.max(0, ...ts.filter((x) => x.off >= 0).map((x) => x.off + x.dur - 1));
  if (!D || !span || D === span) return [...ts];
  const P = Math.max(0, Math.min(90, Math.round(D / 2), span - 1));
  const f = (D - P) / (span - P);
  const mm = (x: number) => (x <= P ? x : Math.round(P + (x - P) * f));
  return ts.map((x) => { if (x.off < 0) return x; const a = mm(x.off); const z = mm(x.off + x.dur - 1); return { ...x, off: a, dur: Math.max(1, z - a + 1) }; });
}
/** 템플릿 → 새 사업 업무 (applyTemplate): 시작 = 협약 시작 + off, PM = 사업 PM, 담당은 keepPeople 일 때만 */
export function makeTasks(p: PmProject, ts: readonly TplTask[], keepPeople: boolean, order0 = 0): PmTask[] {
  const fit = p.end ? fitDays(ts, p.start, p.end) : ts;
  const seen = new Set<string>();
  return fit.map((x, i) => {
    let c = x.code || String(i + 1);
    while (seen.has(c)) c = `${c}-${i + 1}`;
    seen.add(c);
    return pmTaskSchema.parse({ id: `${p.id}|${c}`, projectId: p.id, stage: x.stage, group: '', code: c, name: x.name, output: x.output, pmName: p.pmName,
      assigneeIds: keepPeople ? x.assigneeIds : [], start: addDays(p.start, x.off), end: addDays(p.start, x.off + x.dur - 1), milestone: x.milestone, status: '계획', order: order0 + i });
  });
}

// ── 협약 이전 업무 날짜 (alignPre 7467 · prePastDone 7480) ──
const PRE_ANCHOR: ReadonlyArray<readonly [RegExp, 'annDue' | 'evalDate']> = [[/신청·접수|온라인 신청/, 'annDue'], [/평가 발표|발표·질의/, 'evalDate']];
const wbsNum = (w: string) => String(w || '').split(/[.-]/).map((n) => String(+n || 0).padStart(4, '0')).join('.');
/** 협약 이전 업무 일정을 공고 마감 · 선정평가일 · 협약일에 맞춤 → 바뀐 업무 [id, start, end] */
export function alignPre(p: PmProject, tasks: readonly PmTask[], done: (t: PmTask) => boolean): Array<{ id: string; start: string; end: string }> {
  if (!p.start) return [];
  const rows = tasks.filter((t) => t.projectId === p.id && isPre(t)).sort((a, b) => (wbsNum(b.code) < wbsNum(a.code) ? -1 : 1));
  let cur = addDays(p.start, -1);
  const out: Array<{ id: string; start: string; end: string }> = [];
  for (const t of rows) {
    const a = PRE_ANCHOR.find(([re]) => re.test(t.name));
    if (a && p[a[1]] && p[a[1]] < cur) cur = p[a[1]];
    const dur = t.start && t.end ? Math.max(0, diffDays(t.start, t.end)) : 0;
    let s = t.start;
    if (!done(t) && t.end !== cur) { s = addDays(cur, -dur); out.push({ id: t.id, start: s, end: cur }); }
    cur = addDays(s || cur, -1);
  }
  return out;
}
/** 날짜가 이미 지난 협약 이전 업무 (prePastDone) — 등록 때 '이미 한 일이면 완료' 확인용 */
export const prePast = (p: PmProject, tasks: readonly PmTask[], done: (t: PmTask) => boolean, today: string) =>
  tasks.filter((t) => t.projectId === p.id && isPre(t) && !done(t) && !!t.end && t.end < today);

/** 사업키 번호 (P14 → 14) */
export const projectNo = keyNum;
/**
 * 다음 사업키 (nextKey) — P + (가장 큰 번호 + 1). `used` = 지운 사업까지 지금까지 쓴 가장 큰 번호 (결정 (가) 11/26, 데모와 다름 —
 * 지운 사업 번호를 다시 주지 않아 남겨 둔 변경 이력 · 업무계획 줄이 새 사업에 섞이지 않게). 사업키 칸에 옛 번호를 직접 치면 막지 않음 (설계 5.7.2).
 */
export const nextProjectKey = (projects: readonly PmProject[], tasks: readonly PmTask[], used = 0) =>
  `P${Math.max(0, used, ...projects.map((p) => keyNum(p.id)), ...tasks.map((t) => keyNum(t.projectId))) + 1}`;

/** 사업 입력 확인 (siteForm validate) */
export function projectCheck(v: { id: string; company: string; biz: string; start: string; end: string; bizRegNo: string; contactEmail: string; budget: number | null; subsidy: number | null }, isNew: boolean, exists: (id: string) => boolean): [string, string] | null {
  if (isNew && !/^P\d+$/.test(v.id)) return ['사업키는 P + 숫자 형식이어야 합니다 (예: P14)', 'id'];
  if (isNew && exists(v.id)) return ['이미 사용 중인 사업키입니다', 'id'];
  if (!v.company.trim()) return ['도입 · 참여기업을 입력해 주세요', 'company'];
  if (!v.biz) return ['사업구분을 골라 주세요', 'biz'];
  if (!v.start) return ['협약 시작일을 입력해 주세요', 'start'];
  if (!v.end) return ['협약 종료일을 입력해 주세요', 'end'];
  if (v.bizRegNo && !/^\d{3}-\d{2}-\d{5}$/.test(v.bizRegNo)) return ['사업자등록번호 형식이 올바르지 않습니다 (000-00-00000)', 'bizRegNo'];
  if (v.contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.contactEmail)) return ['이메일 형식이 올바르지 않습니다', 'contactEmail'];
  if (v.end <= v.start) return ['협약 종료일은 시작일 이후여야 합니다', 'end'];
  if (v.subsidy != null && v.budget != null && v.subsidy > v.budget) return ['정부 지원금은 총 사업비를 초과할 수 없습니다', 'subsidy'];
  return null;
}
