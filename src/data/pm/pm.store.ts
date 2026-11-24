import { applyProgress, makeBaseline, todayStr } from '@/domain/pm/rules';
import type { PmBaseline, PmChangeLog, PmProject, PmSubtask, PmTask, PmTaskDone, PmTaskFunctions } from '@/domain/pm/schema';
import { SEED_VERSION, seedFunctions, seedProjects, seedSubtasks, seedTasks } from './seed';

/**
 * PM 저장소 — 1단계는 **메모리 전용** (§5.1: `pm*` 컬렉션이 아직 없어 `VITE_DB_DRIVER=appwrite` 여도 메모리).
 * 새로 고침하면 데모 내장 데이터로 돌아간다. 7단계(허락 후)에 컬렉션별 `createCrudBackend` 로 바꾼다.
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
  /** 데이터 출처 표시 (데모 ver) */
  sourceVersion: string;
}

const clone = <T>(v: T): T => structuredClone(v);
let seq = 0;
const nid = (p: string) => `${p}${Date.now().toString(36)}${(++seq).toString(36)}`;

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

export function createPmStore(today = todayStr()) {
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
  const state: PmSnapshot = { projects, tasks, functions, subtasks, baselines, logs: [], done: [], sourceVersion: SEED_VERSION };

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
    for (const s of state.subtasks) if (s.taskId === oldId) s.taskId = newId;
    for (const f of state.functions) if (f.id === oldId) f.id = newId;
    for (const d of state.done) if (d.id === oldId) d.id = newId;
    for (const b of state.baselines) if (b.map[oldId]) { b.map[newId] = b.map[oldId]; delete b.map[oldId]; }
    for (const t of state.tasks) t.predecessorIds = t.predecessorIds.map((x) => (x === oldId ? newId : x));
  };

  return {
    async snapshot(): Promise<PmSnapshot> {
      return clone(state);
    },

    /** 업무 추가 (wbsNew·wbsCopy) — 같은 사업·단계의 마지막 뒤에 넣음 */
    async addTask(t: PmTask, by: string, day = todayStr()): Promise<PmTask> {
      if (state.tasks.some((x) => x.id === t.id)) throw new Error(`이미 ${t.code} 번호가 있습니다`);
      let at = -1;
      state.tasks.forEach((x, i) => { if (x.projectId === t.projectId && (x.group || x.stage) === (t.group || t.stage)) at = i; });
      if (at < 0) state.tasks.forEach((x, i) => { if (x.projectId === t.projectId) at = i; });
      state.tasks.splice(at < 0 ? state.tasks.length : at + 1, 0, clone(t));
      log(t.projectId, t.code, '추가', t.name, by, day);
      return clone(t);
    },

    /** 업무 수정 (wbsEdit) — 바뀐 칸을 변경 이력에 */
    async updateTask(id: string, next: PmTask, by: string, nameOf?: (id: string) => string, day = todayStr()): Promise<PmTask> {
      const i = findTask(id);
      const old = state.tasks[i];
      if (next.id !== id && state.tasks.some((x) => x.id === next.id)) throw new Error(`이미 ${next.code} 번호가 있습니다`);
      state.tasks[i] = clone(next);
      rekey(id, next.id);
      log(next.projectId, next.code, '수정', diffText(old, next, nameOf) || '변경 없음', by, day);
      return clone(next);
    },

    /** 일괄 수정 (wbsBulk) — 화면이 고친 업무들 + 업무별 바뀐 내용 요약 */
    async bulkUpdate(items: ReadonlyArray<{ next: PmTask; summary: string }>, by: string, day = todayStr()) {
      for (const { next, summary } of items) {
        const i = findTask(next.id);
        state.tasks[i] = clone(next);
        if (summary) log(next.projectId, next.code, '수정', `일괄 수정: ${summary}`, by, day);
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
    },

    async addSubtask(taskId: string, text: string, assigneeId: string, due: string, by: string, day = todayStr()): Promise<PmSubtask> {
      const order = Math.max(-1, ...state.subtasks.filter((s) => s.taskId === taskId).map((s) => s.order)) + 1;
      const s: PmSubtask = { id: nid('s'), taskId, text, assigneeId, due, estHours: 0, done: false, doneDate: '', memo: '', createdBy: by, createdDate: day, fromFp: false, order };
      state.subtasks.push(s);
      return clone(s);
    },
    async updateSubtask(id: string, patch: Partial<Omit<PmSubtask, 'id' | 'taskId'>>, day = todayStr()) {
      const s = state.subtasks.find((x) => x.id === id);
      if (!s) throw new Error('세부 작업을 찾을 수 없습니다');
      Object.assign(s, patch);
      if ('done' in patch) s.doneDate = patch.done ? day : '';
    },
    async removeSubtask(id: string) {
      state.subtasks = state.subtasks.filter((x) => x.id !== id);
    },

    /** 기준선 재설정 (baseSet) */
    async resetBaseline(projectId: string, label: string, by: string, day = todayStr()) {
      const ts = state.tasks.filter((t) => t.projectId === projectId);
      const b = makeBaseline(projectId, ts, label, day, by);
      state.baselines = [...state.baselines.filter((x) => x.id !== projectId), b];
      log(projectId, '', '기준선', `기준선 재설정 — ${label} (업무 ${ts.length}건)`, by, day);
    },
  };
}

export type PmStore = ReturnType<typeof createPmStore>;

let store: PmStore | null = null;
/** 화면이 쓰는 저장소 하나 (처음 부를 때 만든다) */
export const pmStore = () => (store ??= createPmStore());
