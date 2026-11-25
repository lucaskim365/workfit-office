import { z } from 'zod';
import { addDays, diffDays, type Live } from './rules';
import type { PmSubtask, PmTask } from './schema';

/**
 * 티켓 (`pmTickets`) — 데모 '업무 목록 · 티켓' › 티켓 목록 (pTickets 1888 · renderTk 1933 · tkMove 1999 · newTicket 1590).
 * 업무 1건 = 티켓 1건 (취소 빼고), 세부 작업 1건 = 티켓 1건.
 * 사람 칸은 그룹웨어 사용자 ID (데모는 이름 글자). 기록의 `by` = 사용자 ID, 시스템이 남기면 'system'.
 * ([[2026-11-24-pms-port-design]] 5장 2단계 · 부록 A)
 */

export const PM_TICKET_FLOW = ['발행', '접수', '진행중', '검토요청', '완료'] as const;
export const PM_TICKET_STATUSES = [...PM_TICKET_FLOW, '보류', '취소'] as const;
export type PmTicketStatus = (typeof PM_TICKET_STATUSES)[number];
export const PM_TICKET_PRIOS = ['긴급', '높음', '보통', '낮음'] as const;
export type PmTicketPrio = (typeof PM_TICKET_PRIOS)[number];
export const PM_TICKET_TYPES = ['개발', '인프라', '시험·검증', '설계', '분석', 'PM', '영업·기획', '운영·이관'] as const;
export type PmTicketType = (typeof PM_TICKET_TYPES)[number];

const day = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, '날짜 형식이 아닙니다');

export const pmTicketHistSchema = z.object({
  date: day,
  /** 사용자 ID 또는 'system' */
  by: z.string().default(''),
  text: z.string(),
  /** 칸 변경이면 칸 이름 (같은 날 같은 사람이 연달아 고치면 한 줄로 합침) */
  field: z.string().optional(),
  from: z.string().optional(),
  /** 코멘트 줄 */
  comment: z.boolean().optional(),
});
export type PmTicketHist = z.infer<typeof pmTicketHistSchema>;

export const pmTicketSchema = z.object({
  /** 티켓 번호 P2-0001 = 문서 ID */
  no: z.string().regex(/^P\d+-\d{4,}$/),
  projectId: z.string().min(1),
  /** 업무 ID. 옛 티켓(예전 WBS 번호)은 '' — 지금 업무 목록과 연결 없음 */
  taskId: z.string().default(''),
  /** 세부 작업 티켓이면 세부 작업 ID */
  subtaskId: z.string().default(''),
  /** 옛 업무 = 예전 WBS 번호 (예: "P2|5.24"). 있으면 '옛 업무' 표시만 하고 업무와 잇지 않음 (11/24 사용자) */
  legacyKey: z.string().default(''),
  /** 업무 번호 (발행할 때 값) */
  code: z.string().default(''),
  title: z.string().min(1),
  /** 세부 작업 티켓이면 부모 업무명 */
  parent: z.string().default(''),
  output: z.string().default(''),
  stage: z.string().default(''),
  type: z.enum(PM_TICKET_TYPES).default('개발'),
  /** 승인자 (기본 = 업무 PM) */
  approverId: z.string().default(''),
  /** 검토자 (선택) — 있으면 검토 통과 뒤 승인자가 최종 승인 */
  reviewerId: z.string().default(''),
  reviewOk: z.boolean().default(false),
  assigneeId: z.string().default(''),
  watcherIds: z.array(z.string()).default([]),
  prio: z.enum(PM_TICKET_PRIOS).default('보통'),
  start: day.default(''),
  due: day.default(''),
  status: z.enum(PM_TICKET_STATUSES).default('발행'),
  prog: z.number().min(0).max(100).default(0),
  created: day,
  issuerId: z.string().default(''),
  memo: z.string().default(''),
  /** 산출물 첨부 — 이름·링크 글자 (파일 올리기는 Storage 연결 단계) */
  files: z.array(z.object({ name: z.string(), date: day, by: z.string() })).default([]),
  /** 업무 원본이 바뀜: '일정 변경' | '원본 삭제' | '' */
  taskChange: z.string().default(''),
  hist: z.array(pmTicketHistSchema).default([]),
});
export type PmTicket = z.infer<typeof pmTicketSchema>;

export const SYSTEM = 'system';

// ── 판정 ─────────────────────────────────────────────

export const tkOpen = (x: PmTicket) => x.status !== '완료' && x.status !== '취소';
export const tkLate = (x: PmTicket, today: string) => tkOpen(x) && !!x.due && diffDays(today, x.due) < 0;
/** 검토자 차례인가 (검토요청 · 검토자 있음 · 아직 통과 전) */
export const tkReviewPending = (x: PmTicket) => x.status === '검토요청' && !!x.reviewerId && !x.reviewOk;
/** 지금 처리할 사람 (데모 expect) */
export function tkExpected(x: PmTicket): string {
  if (x.status === '검토요청') return tkReviewPending(x) ? x.reviewerId : x.approverId;
  if (x.status === '완료' || x.status === '취소') return '';
  return x.assigneeId;
}
/** 옛 업무 티켓 (예전 WBS 번호, 업무 연결 없음) */
export const isLegacy = (x: { legacyKey: string }) => !!x.legacyKey;

/** 업무 티켓 색인: 업무 ID → 티켓 (취소·세부 작업·옛 티켓 제외 — tkIndex 1553) */
export function taskTicketIndex(ts: readonly PmTicket[]): Map<string, PmTicket> {
  return new Map(ts.filter((x) => x.status !== '취소' && !x.subtaskId && x.taskId && !x.legacyKey).map((x) => [x.taskId, x]));
}
/** 세부 작업 티켓 (취소 제외, 마지막 것) */
export function subTicketOf(ts: readonly PmTicket[], subtaskId: string): PmTicket | undefined {
  return ts.filter((x) => x.subtaskId === subtaskId && x.status !== '취소').pop();
}

/** 단계 → 티켓 종류 (autoType 1539) */
export function ticketType(stage: string): PmTicketType {
  const s = stage || '';
  if (/협약 이전/.test(s)) return '영업·기획';
  if (/프로젝트관리/.test(s)) return 'PM';
  if (/관제|HILT|모델|AI|S\/W|MES|소프트웨어|데이터|안정화·유효/.test(s) && !/시험/.test(s)) return '개발';
  if (/분석|진단/.test(s)) return '분석';
  if (/설계|기준정의|계측/.test(s)) return '설계';
  if (/H\/W|인프라|Cloud|N\/W|하드웨어|착수정비/.test(s)) return '인프라';
  if (/시험|검수|실증|통합|검증/.test(s)) return '시험·검증';
  if (/교육|운영|완료|인수|종료|확산/.test(s)) return '운영·이관';
  return '개발';
}

/** 기본 우선순위 (tkPrioOf 1563): 마일스톤 = 높음, 종료일 지남·미완료 = 긴급, 나머지 보통 */
export function defaultPrio(t: PmTask, l: Live, today: string): PmTicketPrio {
  if (t.milestone) return '높음';
  if (t.end && t.end < today && l.status !== '완료') return '긴급';
  return '보통';
}

// ── 번호 ─────────────────────────────────────────────

/** 다음 티켓 번호: 그 사업의 가장 큰 번호 + 1 (데모 tkSeq 를 따로 두지 않고 번호에서 계산) */
export function nextTicketNo(ts: readonly PmTicket[], projectId: string): string {
  let max = 0;
  for (const x of ts) {
    const m = x.no.match(/^(P\d+)-(\d+)$/);
    if (m && m[1] === projectId) max = Math.max(max, +m[2]);
  }
  return `${projectId}-${String(max + 1).padStart(4, '0')}`;
}

// ── 발행 ─────────────────────────────────────────────

export interface IssueRow {
  task: PmTask;
  assigneeId: string;
  prio: PmTicketPrio;
  due: string;
}
export interface IssueOpts {
  reviewerId: string;
  /** 비면 업무 PM */
  approverId: string;
  memo: string;
}

/** 발행 전 확인 (submitIssue 1823) — 오류 문구 목록 (비면 통과) */
export function checkIssue(rows: readonly IssueRow[], o: IssueOpts, issued: ReadonlySet<string>, approverOf: (t: PmTask) => string): string[] {
  const err: string[] = [];
  const miss = rows.filter((r) => !r.assigneeId).length;
  const noDue = rows.filter((r) => !r.due).length;
  if (miss) err.push(`담당자가 지정되지 않은 업무가 ${miss}건 있습니다. 담당자를 지정해야 발행할 수 있습니다.`);
  if (noDue) err.push(`마감일이 없는 업무가 ${noDue}건 있습니다.`);
  const dup = rows.filter((r) => issued.has(r.task.id)).length;
  if (dup) err.push(`이미 발행된 업무 ${dup}건이 포함되어 있습니다.`);
  if (o.reviewerId && o.approverId && o.reviewerId === o.approverId) err.push('검토자와 승인자가 같습니다. 한 사람이 검토·승인을 모두 하면 검토자를 비워 두세요.');
  const noAp = rows.filter((r) => !(o.approverId || approverOf(r.task))).length;
  if (noAp) err.push(`승인자가 없는 업무가 ${noAp}건 있습니다 (업무 PM이 그룹웨어 사용자와 이어지지 않음). 승인자를 고르세요.`);
  return err;
}

/** 업무 티켓 만들기 (newTicket 1590) */
export function makeTaskTicket(no: string, r: IssueRow, o: IssueOpts, ctx: { today: string; me: string; live: Live; approverOf: (t: PmTask) => string; nameOf: (id: string) => string }): PmTicket {
  const t = r.task;
  const approverId = o.approverId || ctx.approverOf(t);
  const reviewerId = o.reviewerId && o.reviewerId !== approverId ? o.reviewerId : '';
  const hist: PmTicketHist[] = [{
    date: ctx.today, by: ctx.me,
    text: `티켓 발행 — 업무 ${t.code} · 담당 ${ctx.nameOf(r.assigneeId)} · ${reviewerId ? `검토 ${ctx.nameOf(reviewerId)} → ` : ''}승인 ${ctx.nameOf(approverId) || '-'}`,
  }];
  if (o.memo) hist.push({ date: ctx.today, by: ctx.me, text: `💬 ${o.memo}`, comment: true });
  if (t.end && r.due > t.end) hist.push({ date: ctx.today, by: ctx.me, text: `⚠ 마감일을 업무 종료일(${t.end})보다 늦게 지정 (${r.due})` });
  return {
    no, projectId: t.projectId, taskId: t.id, subtaskId: '', legacyKey: '', code: t.code, title: t.name, parent: '', output: t.output,
    stage: t.stage, type: ticketType(t.stage), approverId, reviewerId, reviewOk: false, assigneeId: r.assigneeId,
    watcherIds: t.assigneeIds.filter((x) => x && x !== r.assigneeId), prio: r.prio, start: t.start, due: r.due,
    status: '발행', prog: Math.round(ctx.live.pct) || 0, created: ctx.today, issuerId: ctx.me, memo: o.memo, files: [], taskChange: '', hist,
  };
}

/** 세부 작업 티켓 (newSubTicket 5361): 담당 = 세부 작업 담당, 마감 = 예정일 없으면 업무 종료일 */
export function makeSubTicket(no: string, t: PmTask, s: PmSubtask, ctx: { today: string; me: string; approverOf: (t: PmTask) => string; nameOf: (id: string) => string }): PmTicket {
  const due = s.due || t.end || '';
  return {
    no, projectId: t.projectId, taskId: t.id, subtaskId: s.id, legacyKey: '', code: t.code, title: s.text, parent: t.name, output: t.output,
    stage: t.stage, type: ticketType(t.stage), approverId: ctx.approverOf(t), reviewerId: '', reviewOk: false, assigneeId: s.assigneeId,
    watcherIds: t.assigneeIds.filter((x) => x && x !== s.assigneeId).slice(0, 3),
    prio: due && due < ctx.today ? '긴급' : t.milestone ? '높음' : '보통', start: ctx.today, due, status: '발행', prog: 0,
    created: ctx.today, issuerId: ctx.me, memo: '', files: [], taskChange: '',
    hist: [{ date: ctx.today, by: ctx.me, text: `세부 작업 티켓 발행 — 업무 ${t.code} › ${s.text} · 담당 ${ctx.nameOf(s.assigneeId)}` }],
  };
}

// ── 상태 이동 ─────────────────────────────────────────

const NEXT: Record<PmTicketStatus, readonly PmTicketStatus[]> = {
  발행: ['접수', '취소'], 접수: ['진행중', '보류'], 진행중: ['검토요청', '보류'], 검토요청: ['완료', '진행중', '보류'], 보류: ['진행중'], 완료: ['진행중'], 취소: [],
};

/** 상세 창 버튼 (renderTk acts): [이동할 상태, 글자, 모양] */
export function ticketActions(x: PmTicket): Array<readonly [PmTicketStatus, string, 'primary' | 'danger' | 'ok' | 'plain']> {
  const a: Array<readonly [PmTicketStatus, string, 'primary' | 'danger' | 'ok' | 'plain']> = ({
    발행: [['접수', '접수', 'primary'], ['취소', '발행 취소', 'danger']],
    접수: [['진행중', '작업 시작', 'primary']],
    진행중: [['검토요청', '검토 요청', 'primary']],
    검토요청: [['완료', tkReviewPending(x) ? '검토 통과' : '승인 · 완료', 'ok'], ['진행중', '반려 (재작업)', 'danger']],
    보류: [['진행중', '작업 재개', 'primary']],
    완료: [['진행중', '재오픈', 'plain']],
    취소: [],
  } as const)[x.status].map((v) => v);
  if (x.status === '접수' || x.status === '진행중' || x.status === '검토요청') a.push(['보류', '보류', 'plain']);
  return a;
}

export type MoveResult =
  | { ok: false; error: string }
  | { ok: true; ticket: PmTicket; message: string; /** 세부 작업 티켓: 세부 작업 완료 true / 완료 취소 false / 그대로 null */ subDone: boolean | null };

/** 상태 이동 (tkMove 1999). 원본을 바꾸지 않고 새 티켓을 돌려준다 */
export function moveTicket(x0: PmTicket, to: PmTicketStatus, cmt: string, me: string, today: string, nameOf: (id: string) => string): MoveResult {
  const x: PmTicket = structuredClone(x0);
  const from = x.status;
  if (!NEXT[from].includes(to)) {
    if (to === '완료' && (from === '접수' || from === '진행중')) return { ok: false, error: '완료하려면 먼저 검토 요청하고, 승인을 받아야 합니다.' };
    return { ok: false, error: `'${from}' 상태에서 '${to}'(으)로 바로 이동할 수 없습니다.` };
  }
  if ((to === '보류' || (from === '검토요청' && to === '진행중')) && !cmt) return { ok: false, error: from === '검토요청' ? '반려 사유를 코멘트란에 입력해 주세요.' : '보류 사유를 코멘트란에 입력해 주세요.' };
  if (from === '완료' && to === '진행중' && !cmt) return { ok: false, error: '재오픈 사유를 코멘트란에 입력해 주세요.' };
  // 대리 처리 판단 (tkMove 2008 expect): 보류는 처리할 사람을 따지지 않음 — 안내 문구(tkExpected)와 다름
  const expect = x0.status === '보류' ? '' : tkExpected(x0);
  const proxy = expect && expect !== me && to !== '취소' ? ' (대리 처리)' : '';
  const tail = `${cmt ? ` — ${cmt}` : ''}${proxy}`;
  // 검토자가 있으면 '완료'는 먼저 검토 통과만 기록하고 승인자 차례로
  if (from === '검토요청' && to === '완료' && tkReviewPending(x)) {
    x.reviewOk = true;
    x.hist.push({ date: today, by: me, text: `검토 통과 — 승인자 ${nameOf(x.approverId)} 승인 요청${tail}` });
    return { ok: true, ticket: x, message: `${x.no} 검토 통과 — ${nameOf(x.approverId)} 승인 대기`, subDone: null };
  }
  if (to === '완료' && !x.approverId) return { ok: false, error: '승인자가 지정되지 않았습니다. 오른쪽에서 승인자를 지정하고 아래 [수정]을 눌러 주세요.' };
  const label = to === '접수' ? '티켓 접수'
    : to === '진행중' ? (from === '검토요청' ? '반려 — 재작업 요청' : from === '보류' ? '작업 재개' : from === '완료' ? '재오픈' : '작업 시작')
      : to === '검토요청' ? `검토 요청 (${x.reviewerId ? `검토 ${nameOf(x.reviewerId)} → ` : ''}승인 ${nameOf(x.approverId) || '-'})`
        : to === '완료' ? (x.reviewerId ? '최종 승인 · 완료' : '승인 · 완료')
          : to === '보류' ? '보류' : '발행 취소';
  x.status = to;
  if (to !== '완료') x.reviewOk = false;
  if (to === '검토요청' || to === '완료') x.prog = 100;
  if (from === '검토요청' && to === '진행중') x.prog = Math.min(x.prog, 90);
  x.hist.push({ date: today, by: me, text: `${label}${tail}` });
  const subDone = x.subtaskId ? (to === '완료' ? true : from === '완료' ? false : null) : null;
  const message = `${x.no} ${label}${to === '완료' ? ' — 업무 실적 100% 반영' : to === '취소' ? ' — 이 업무는 다시 발행할 수 있습니다' : ''}`;
  return { ok: true, ticket: x, message, subDone };
}

/** 칸 변경 기록 (tkHist 1573): 같은 사람이 같은 날 같은 칸을 연달아 고치면 한 줄로 (A→B, B→C ⇒ A→C, 원래로 돌아오면 줄 삭제) */
export function pushFieldHist(H: PmTicketHist[], field: string, label: string, from: string, to: string, me: string, today: string, note = '') {
  let i = H.length - 1;
  while (i >= 0 && H[i].field && H[i].field !== field && H[i].by === me && H[i].date === today) i--;
  const h = H[i];
  if (h && h.field === field && h.by === me && h.date === today) {
    if (String(h.from) === String(to)) { H.splice(i, 1); return; }
    from = h.from ?? from;
    H.splice(i, 1);
  }
  const show = (v: string) => (v === '' || v == null ? '없음' : v);
  H.push({ date: today, by: me, field, from, text: `${label} ${show(from)} → ${show(to)}${note}` });
}

/** 티켓 창에서 [수정]을 눌러야 반영하는 칸 (TK_EDIT) */
export interface TicketDraft { assigneeId: string; reviewerId: string; approverId: string; prio: PmTicketPrio; due: string }
export const TICKET_EDIT_FIELDS = ['assigneeId', 'reviewerId', 'approverId', 'prio', 'due'] as const;

/** [수정] 반영 (tkSave 6327): 확인 → 바뀐 칸마다 기록. 담당이 바뀌면 다시 접수해야 함 (발행 상태로) */
export function applyTicketDraft(x0: PmTicket, D: TicketDraft, me: string, today: string, nameOf: (id: string) => string, taskEnd: string):
  { ok: false; error: string } | { ok: true; ticket: PmTicket; changed: number } {
  const x: PmTicket = structuredClone(x0);
  const ch = (k: (typeof TICKET_EDIT_FIELDS)[number]) => D[k] !== x0[k];
  if (ch('due') && !D.due) return { ok: false, error: '마감일을 입력하세요' };
  if (!D.approverId) return { ok: false, error: '승인자를 지정하세요' };
  if (D.reviewerId && D.reviewerId === D.approverId) return { ok: false, error: '검토자와 승인자가 같습니다. 한 사람이 검토·승인을 모두 하면 검토자를 비워 두세요' };
  const changed = TICKET_EDIT_FIELDS.filter(ch).length;
  if (!changed) return { ok: true, ticket: x, changed: 0 };
  if (ch('assigneeId')) {
    const o = x.assigneeId;
    x.assigneeId = D.assigneeId;
    x.watcherIds = x.watcherIds.filter((w) => w !== D.assigneeId);
    if (o && !x.watcherIds.includes(o)) x.watcherIds.push(o);
    x.hist.push({ date: today, by: me, text: `담당자 변경 ${nameOf(o) || '없음'} → ${nameOf(D.assigneeId) || '없음'}` });
    if (x.status !== '발행' && tkOpen(x)) {
      x.status = '발행';
      x.hist.push({ date: today, by: SYSTEM, text: '담당자 변경으로 다시 접수 필요 (발행 상태로 전환)' });
    }
  }
  if (ch('reviewerId')) { pushFieldHist(x.hist, 'reviewerId', '검토자', nameOf(x.reviewerId), nameOf(D.reviewerId), me, today); x.reviewerId = D.reviewerId; x.reviewOk = false; }
  if (ch('approverId')) { pushFieldHist(x.hist, 'approverId', '승인자', nameOf(x.approverId), nameOf(D.approverId), me, today); x.approverId = D.approverId; }
  if (ch('prio')) { pushFieldHist(x.hist, 'prio', '우선순위', x.prio, D.prio, me, today); x.prio = D.prio; }
  if (ch('due')) {
    pushFieldHist(x.hist, 'due', '마감일', x.due, D.due, me, today, taskEnd && D.due > taskEnd ? ` (업무 종료일 ${taskEnd} 초과)` : '');
    x.due = D.due;
    if (x.taskChange === '일정 변경') x.taskChange = '';
  }
  return { ok: true, ticket: x, changed };
}

/** 진행률 (tkProg): 접수 상태에서 0보다 크게 올리면 작업 시작 */
export function setTicketProg(x0: PmTicket, n: number, me: string, today: string): PmTicket {
  const x: PmTicket = structuredClone(x0);
  if (x.status === '접수' && n > 0) { x.status = '진행중'; x.hist.push({ date: today, by: me, text: '작업 시작' }); }
  pushFieldHist(x.hist, 'prog', '진행률', `${x.prog}%`, `${n}%`, me, today);
  x.prog = n;
  return x;
}

/**
 * 업무를 고치면 티켓도 따라감 (wbsSyncTicket 6396): 번호·이름·산출물·단계, 일정이 바뀌면
 * 마감이 옛 종료일 그대로였으면 새 종료일로, 아니면 '일정 변경' 표시.
 */
export function syncTicketWithTask(x0: PmTicket, old: PmTask, n: PmTask, me: string, today: string): PmTicket | null {
  if (x0.subtaskId || x0.status === '취소' || x0.legacyKey) return null;
  const x: PmTicket = structuredClone(x0);
  const msgs: string[] = [];
  if (old.id !== n.id) { x.taskId = n.id; x.code = n.code; msgs.push(`업무 번호 ${old.code}→${n.code}`); }
  if (n.name !== x.title) { x.title = n.name; msgs.push('업무명 변경'); }
  if (n.output !== x.output) { x.output = n.output; msgs.push('산출물 변경'); }
  if (n.stage !== x.stage) { x.stage = n.stage; x.type = ticketType(n.stage); }
  if (old.end !== n.end || old.start !== n.start) {
    x.start = n.start;
    if (x.due === old.end && tkOpen(x) && n.end) { x.due = n.end; msgs.push(`마감일 자동 조정 ${old.end || '없음'}→${n.end}`); }
    else { x.taskChange = '일정 변경'; msgs.push(`업무 일정 ${old.start || '-'}~${old.end || '-'} → ${n.start || '-'}~${n.end || '-'} (티켓 마감일 확인 필요)`); }
  }
  if (!msgs.length && JSON.stringify(x) === JSON.stringify(x0)) return null;
  if (msgs.length) x.hist.push({ date: today, by: me, text: `업무 수정 반영 — ${msgs.join(' · ')}` });
  return x;
}

// ── 목록 ─────────────────────────────────────────────

/** doing = 처리 중 (접수 + 진행중) — 위 숫자 칸 '처리 중'을 눌렀을 때 그 숫자 그대로 */
export type TicketStFilter = 'open' | 'all' | 'late' | 'doing' | PmTicketStatus;
export interface TicketFilter { projectId: string; who: string; st: TicketStFilter; q: string }
export const TICKET_FILTER_DEFAULT: TicketFilter = { projectId: 'all', who: 'all', st: 'open', q: '' };

/** 목록 거르기 (tkFiltered 1852): 취소는 '발행 취소'를 골랐을 때만 */
export function filterTickets(ts: readonly PmTicket[], f: TicketFilter, today: string, nameOf: (id: string) => string = (x) => x): PmTicket[] {
  const q = f.q.trim().toLowerCase();
  return ts.filter((x) => {
    if (f.st === '취소' ? x.status !== '취소' : x.status === '취소') return false;
    if (f.projectId !== 'all' && x.projectId !== f.projectId) return false;
    if (f.who !== 'all' && x.assigneeId !== f.who) return false;
    if (f.st === 'open' && !tkOpen(x)) return false;
    if (f.st === 'late' && !tkLate(x, today)) return false;
    if (f.st === 'doing' && x.status !== '접수' && x.status !== '진행중') return false;
    if (!['all', 'open', 'late', 'doing', '취소'].includes(f.st) && x.status !== f.st) return false;
    if (q && !`${x.no} ${x.title} ${x.code} ${x.legacyKey} ${nameOf(x.assigneeId)} ${x.output}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** 위 숫자 칸 5개 (pTickets 1893) — 취소 뺀 전체 기준 */
export function ticketStats(ts: readonly PmTicket[], today: string) {
  const all = ts.filter((x) => x.status !== '취소');
  const n = (s: PmTicketStatus) => all.filter((x) => x.status === s).length;
  const done = n('완료');
  return {
    total: all.length, issued: n('발행'), accepted: n('접수'), running: n('진행중'), hold: n('보류'), review: n('검토요청'),
    late: all.filter((x) => tkLate(x, today)).length, done, donePct: all.length ? Math.round((done / all.length) * 100) : 0,
  };
}

/** 담당별 미완료 (담당 미완료 칩) — 많은 순 */
export function openByAssignee(ts: readonly PmTicket[], today: string) {
  const m = new Map<string, { open: number; late: number; review: number }>();
  for (const x of ts) {
    if (x.status === '취소' || !tkOpen(x)) continue;
    const a = m.get(x.assigneeId) ?? { open: 0, late: 0, review: 0 };
    a.open++;
    if (tkLate(x, today)) a.late++;
    if (x.status === '검토요청') a.review++;
    m.set(x.assigneeId, a);
  }
  return [...m.entries()].sort((a, b) => b[1].open - a[1].open);
}

/** 발행 추천 (tkRec 1878): 미완료 · 티켓 없음 · 시작 있음 · 시작 ≤ 오늘+7. 미리보기 = 안 끝난 것 중 시작이 오늘과 가까운 순 */
export function ticketRecommend(ts: readonly PmTask[], liveMap: ReadonlyMap<string, Live>, issued: ReadonlySet<string>, today: string) {
  const t7 = addDays(today, 7);
  // ts = 집계 대상 업무만 (부르는 쪽이 workItem 으로 거름 — tkRec 1879)
  const rec = ts.filter((t) => t.start && t.start <= t7 && !issued.has(t.id) && (liveMap.get(t.id)?.status ?? t.status) !== '완료');
  const near = rec.filter((t) => !t.end || t.end >= today).sort((a, b) => Math.abs(diffDays(a.start, today)) - Math.abs(diffDays(b.start, today)));
  return { rec, near, today: rec.filter((t) => t.start === today).length };
}

/** 언제·누가 완료 (doneInfo: TASK 티켓 승인) — 완료 티켓의 마지막 '완료' 기록 */
export function ticketDoneInfo(x: PmTicket | undefined): { date: string; by: string; ticketNo: string } | null {
  if (!x || x.status !== '완료') return null;
  const h = [...x.hist].reverse().find((v) => /승인 · 완료|최종 승인/.test(v.text));
  return h ? { date: h.date, by: h.by, ticketNo: x.no } : null;
}

/** CSV (Jira 가져오기 호환 칸, tkCsv 2026) */
export function ticketCsv(list: readonly PmTicket[], projectOf: (id: string) => { company: string; biz: string }, nameOf: (id: string) => string): string {
  const PR: Record<PmTicketPrio, string> = { 긴급: 'Highest', 높음: 'High', 보통: 'Medium', 낮음: 'Low' };
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Issue Key', 'Summary', 'Description', 'Issue Type', 'Priority', 'Assignee', 'Reporter', 'Start Date', 'Due Date', 'Status', 'Progress', 'Labels', 'WBS', '사업', '도입기업', '단계', '산출물'];
  const rows = list.map((x) => {
    const p = projectOf(x.projectId);
    const wbs = x.legacyKey ? `옛 업무 ${x.legacyKey.split('|')[1] ?? x.legacyKey}` : x.code;
    return [x.no, x.title, `[${x.projectId} ${p.company}] ${x.stage} / 업무 ${wbs}\n산출물: ${x.output}`, 'Task', PR[x.prio], nameOf(x.assigneeId), nameOf(x.issuerId), x.start, x.due, x.status, `${x.prog}%`, `${x.projectId} ${x.type}`.replace(/\s+/g, '_'), wbs, p.biz, p.company, x.stage, x.output];
  });
  return '﻿' + [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
}
