import type { PmFunctionKind, PmProject, PmSubtask, PmTask, PmTaskFunctions } from '@/domain/pm/schema';
import type { PmPlan } from '@/domain/pm/site';
import wbsData from './seed/wbs-data.json';
import planData from './seed/plan-data.json';
import fnData from './seed/fn-data.json';

/**
 * 데모 내장 데이터(`wbs-data`, 11/17 업무 목록 v1.1) → PM 데이터 모양.
 * 1단계 동안 메모리 저장소의 처음 값. 가짜 날짜·담당은 넣지 않는다 (§4.3: 실제 데이터만).
 * ([[2026-11-24-pms-port-design]] §4.1·§5.1)
 */

/** 데모 업무 1줄 칸 순서 (WF) */
const WF = ['k', 'stage', 'wbs', 'task', 'out', 'pm', 'exec', 'dev', 'start', 'end', 'ms', 'st', 'pp', 'ap', 'md', 'grp', 'bb', 'memo', 'info'] as const;
type Row = Record<(typeof WF)[number], unknown>;

/** 데모에서 목록에서 뺀 사업 (2026-10-23 결정: P1 에이스메디칼 — 우리 쪽 할 일이 끝남, DROP_K) */
export const DROPPED_PROJECTS = new Set(['P1']);

interface DemoProject {
  k: string; track?: string; biz?: string; co?: string; sup?: string; no?: string; org?: string;
  pm?: string; start?: string; end?: string; summary?: string;
}
interface DemoData {
  ver: string;
  base: string;
  projects: DemoProject[];
  tasks: unknown[][];
  fn: Record<string, [string, string, string][]>;
}

const DEMO = wbsData as unknown as DemoData;
export const SEED_VERSION = DEMO.ver;
/** 엑셀 갱신일 */
export const SEED_BASE_DATE = DEMO.base;

const s = (v: unknown) => (v == null ? '' : String(v));
const n = (v: unknown) => (v === '' || v == null ? 0 : Number(v) || 0);
const st = (v: unknown): PmTask['status'] => (v === '진행중' || v === '완료' ? v : '계획');

const PLANS = (planData as unknown as { plans: Record<string, PmPlan> }).plans;

export function seedProjects(): PmProject[] {
  return DEMO.projects
    .filter((p) => !DROPPED_PROJECTS.has(p.k))
    .map((p, i) => ({
      id: p.k,
      track: s(p.track),
      biz: s(p.biz),
      company: s(p.co),
      short: '',
      supplier: s(p.sup),
      bizNo: s(p.no),
      org: s(p.org),
      pmName: s(p.pm),
      pmUserId: '',
      start: s(p.start),
      end: s(p.end),
      summary: s(p.summary),
      closed: false,
      order: i,
      annDue: '', evalDate: '', bidRes: '', bidAt: null, warrantyM: null,
      // 업종 · 소재지는 계획서 값으로 한 번 채움 (데모 applyPlanInfo 6902 — 켤 때 빈 칸만)
      ceo: '', industry: s(PLANS[p.k]?.industry), region: s(PLANS[p.k]?.region), bizRegNo: '', contactName: '', contactPhone: '', contactEmail: '', lines: [], equip: [],
    }) satisfies PmProject);
}

/** 사업계획서 내장 데이터 (`plan-data`, 계획서 7건 · 금액 천원) — 계획서 약속 기한·사업 개요·성과지표 (§3단계) */
export function seedPlans(): Record<string, PmPlan> {
  return structuredClone((planData as unknown as { plans: Record<string, PmPlan> }).plans);
}

/** 계획서 기능 목록 (`fn-data`: [메뉴, 기능, 구분(추가·변경·기존)]) — 계획서 약속 기능 진척 */
export function seedPlanFunctions(): Record<string, Array<[string, string, string]>> {
  return structuredClone((fnData as unknown as { fns: Record<string, Array<[string, string, string]>> }).fns);
}

export function seedTasks(): PmTask[] {
  return DEMO.tasks
    .map((a) => Object.fromEntries(WF.map((f, i) => [f, a[i]])) as Row)
    // bb = 카드 계산용 숨김 줄 — 새 업무 목록에는 없다 (있으면 빼고 옮김)
    .filter((o) => !DROPPED_PROJECTS.has(s(o.k)) && !o.bb)
    .map((o, i) => {
      const ap = Math.max(0, Math.min(100, n(o.ap)));
      const md = o.md === '' || o.md == null ? null : Number(o.md);
      return {
        id: `${s(o.k)}|${s(o.wbs)}`,
        projectId: s(o.k),
        stage: s(o.stage),
        group: s(o.grp),
        code: s(o.wbs),
        name: s(o.task),
        output: s(o.out),
        pmName: s(o.pm),
        // 데모의 실행·개발 담당은 이름 글자 — 지금 데이터는 모두 비어 있음. 그룹웨어 사용자와 잇는 건 옮기기 스크립트(§4.4)
        assigneeIds: [],
        subAssigneeIds: [],
        execMemo: [s(o.exec), s(o.dev)].filter(Boolean).join(' / '),
        start: s(o.start),
        end: s(o.end),
        milestone: !!o.ms,
        status: st(o.st),
        planPct: Math.max(0, Math.min(100, n(o.pp))),
        actualPct: ap,
        md: md != null && Number.isFinite(md) ? md : null,
        memo: s(o.memo),
        info: s(o.info),
        predecessorIds: [],
        order: i,
        dept: '',
        excludeFromProgress: false,
        fpExcluded: null,
      } satisfies PmTask;
    });
}

const KIND = (v: string): PmFunctionKind => (v === '신규' || v === '변경' ? v : '재사용');

export function seedFunctions(): PmTaskFunctions[] {
  return Object.entries(DEMO.fn ?? {})
    .filter(([key]) => !DROPPED_PROJECTS.has(key.split('|')[0]))
    .map(([id, rows]) => ({ id, items: rows.map(([name, kind, note]) => ({ name, kind: KIND(kind), note: note ?? '' })) }));
}

/**
 * 세부 작업 미리 넣기 (데모 마이그레이션 2530 · subSeed): FP 세부 기능 중 신규·변경만 세부 작업으로 1회.
 * 담당은 비움. 지운 건 다시 안 생기도록 저장소가 '넣은 업무' 표시를 따로 가진다.
 */
export function seedSubtasks(fns: readonly PmTaskFunctions[], today: string): PmSubtask[] {
  const out: PmSubtask[] = [];
  for (const f of fns) {
    f.items.forEach((r, i) => {
      if (r.kind !== '신규' && r.kind !== '변경') return;
      out.push({
        id: `fp-${f.id.replace(/\W/g, '')}-${i}`,
        taskId: f.id,
        text: `[${r.kind}] ${r.name}${r.note ? ` (${r.note})` : ''}`,
        assigneeId: '',
        due: '',
        estHours: 0,
        done: false,
        doneDate: '',
        memo: '',
        createdBy: '',
        createdDate: today,
        fromFp: true,
        legacyKey: '',
        order: i,
      });
    });
  }
  return out;
}
