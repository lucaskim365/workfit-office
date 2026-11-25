import { applyProgress, makeBaseline, todayStr } from '@/domain/pm/rules';
import type {
  PmAction, PmAgreementChange, PmBaseline, PmChangeLog, PmGovLink, PmGovRecord, PmIssue, PmMilestoneOk, PmPlanCheck,
  PmProject, PmSubtask, PmTask, PmTaskDone, PmTaskFunctions,
} from '@/domain/pm/schema';
import type { PmPlan } from '@/domain/pm/site';
import { SEED_BASE_DATE, SEED_VERSION, seedFunctions, seedPlanFunctions, seedPlans, seedProjects, seedSubtasks, seedTasks } from './seed';
import { moveTicket, nextTicketNo, syncTicketWithTask, tkOpen, type PmTicket } from '@/domain/pm/ticket';

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
  /** 티켓 (2단계) — 메모리. 옛 티켓(state.json)은 7단계 옮기기 때 들어옴 */
  tickets: PmTicket[];
  /** 데이터 출처 표시 (데모 ver) */
  sourceVersion: string;
  /** 업무 목록 엑셀 갱신일 (데모 base) — 사업 '갱신 n일 전'의 바탕 */
  baseDate: string;
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
  const state: PmSnapshot = { projects, tasks, functions, subtasks, baselines, logs: [], done: [], tickets: [], sourceVersion: SEED_VERSION,
    baseDate: SEED_BASE_DATE, plans: seedPlans(), planFunctions: seedPlanFunctions(),
    gov: [], planChecks: [], govLinks: [], agreements: [], msOk: [], issues: [], actions: [],
  };

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
    // 세부 작업 티켓도 새 번호로 (업무 티켓은 syncTickets 가 이력과 함께)
    for (const x of state.tickets) if (x.subtaskId && x.taskId === oldId) x.taskId = newId;
  };
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
    if (done === true) { s.done = true; s.doneDate = day; }
    else if (done === false) { s.done = false; s.doneDate = ''; }
    void by;
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
    },

    async addSubtask(taskId: string, text: string, assigneeId: string, due: string, by: string, day = todayStr()): Promise<PmSubtask> {
      const order = Math.max(-1, ...state.subtasks.filter((s) => s.taskId === taskId).map((s) => s.order)) + 1;
      const s: PmSubtask = { id: nid('s'), taskId, text, assigneeId, due, estHours: 0, done: false, doneDate: '', memo: '', createdBy: by, createdDate: day, fromFp: false, order, legacyKey: '' };
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
