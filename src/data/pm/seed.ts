import type { PmFunctionKind, PmProject, PmSubtask, PmTask, PmTaskFunctions } from '@/domain/pm/schema';
import wbsData from './seed/wbs-data.json';

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
    }));
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
        order: i,
      });
    });
  }
  return out;
}
