import assert from 'node:assert/strict';
import test from 'node:test';
import { liveOf } from './rules';
import type { PmSubtask, PmTask } from './schema';
import {
  applyTicketDraft, checkIssue, filterTickets, makeSubTicket, makeTaskTicket, moveTicket, nextTicketNo, openByAssignee,
  pmTicketSchema, pushFieldHist, setTicketProg, syncTicketWithTask, taskTicketIndex, ticketActions, ticketCsv, ticketDoneInfo,
  ticketRecommend, ticketStats, ticketType, tkExpected, tkLate, TICKET_FILTER_DEFAULT, type PmTicket, type PmTicketHist,
} from './ticket';

/** 2단계 티켓 규칙 — 데모 tkMove·newTicket·tkHist·tkFiltered 그대로인지 (테스트용 작은 데이터, 사람은 u1~u4) */
const TODAY = '2026-11-24';
const nameOf = (id: string) => ({ u1: '담당', u2: '검토', u3: '승인', u4: '다른' } as Record<string, string>)[id] ?? '';
const task = (o: Partial<PmTask> = {}): PmTask => ({
  id: 'P2|01-01', projectId: 'P2', stage: 'S/W 개발·연계', group: '01 자재관리', code: '01-01', name: '자재 입고', output: '입고 화면', pmName: '승인 부장',
  assigneeIds: ['u1', 'u4'], subAssigneeIds: [], execMemo: '', start: '2026-11-20', end: '2026-11-30', milestone: false, status: '계획',
  planPct: 0, actualPct: 20, md: 3, memo: '', info: '', predecessorIds: [], order: 0, dept: '', excludeFromProgress: false, fpExcluded: null, ...o,
});
const ctx = { today: TODAY, me: 'u4', approverOf: () => 'u3', nameOf };
const issue = (o: Partial<PmTask> = {}, rev = '') =>
  makeTaskTicket('P2-0001', { task: task(o), assigneeId: 'u1', prio: '보통', due: '2026-11-30' }, { reviewerId: rev, approverId: '', memo: '착수분' }, { ...ctx, live: liveOf(task(o)) });

test('발행: 업무 1건 = 티켓 1건, 승인자 기본 = 업무 PM, 진행률·기록·메모', () => {
  const x = issue();
  assert.equal(pmTicketSchema.safeParse(x).success, true);
  assert.equal(x.approverId, 'u3');
  assert.equal(x.prog, 20);
  assert.deepEqual(x.watcherIds, ['u4']);
  assert.match(x.hist[0].text, /티켓 발행 — 업무 01-01 · 담당 담당 · 승인 승인/);
  assert.equal(x.hist[1].comment, true);
  assert.equal(ticketType('S/W 개발·연계'), '개발');
  assert.equal(ticketType('H/W 구축'), '인프라');
  assert.equal(ticketType('통합 시험'), '시험·검증');
});

test('발행 확인: 담당·마감 없음, 이미 발행, 검토자=승인자, 승인자 없음', () => {
  const rows = [{ task: task(), assigneeId: '', prio: '보통' as const, due: '' }];
  const e = checkIssue(rows, { reviewerId: 'u3', approverId: 'u3', memo: '' }, new Set(['P2|01-01']), () => '');
  assert.equal(e.length, 4);
  assert.deepEqual(checkIssue([{ task: task(), assigneeId: 'u1', prio: '보통', due: '2026-11-30' }], { reviewerId: '', approverId: '', memo: '' }, new Set(), () => ''), ['승인자가 없는 업무가 1건 있습니다 (업무 PM이 그룹웨어 사용자와 이어지지 않음). 승인자를 고르세요.']);
});

test('번호: 사업별 가장 큰 번호 + 1', () => {
  const ts = [{ no: 'P2-0003', projectId: 'P2' }, { no: 'P5-0009', projectId: 'P5' }] as PmTicket[];
  assert.equal(nextTicketNo(ts, 'P2'), 'P2-0004');
  assert.equal(nextTicketNo(ts, 'P7'), 'P7-0001');
});

test('흐름: 발행 → 접수 → 진행 → 검토요청(100%) → 승인·완료, 건너뛰기 막힘', () => {
  let x = issue();
  const step = (to: PmTicket['status'], cmt = '', me = 'u1') => { const r = moveTicket(x, to, cmt, me, TODAY, nameOf); assert.ok(r.ok, !r.ok ? r.error : ''); x = r.ticket; return r; };
  const bad = moveTicket(x, '완료', '', 'u1', TODAY, nameOf);
  assert.equal(bad.ok, false);
  step('접수');
  assert.equal(moveTicket(x, '완료', '', 'u1', TODAY, nameOf).ok, false); // 검토 요청 먼저
  step('진행중');
  step('검토요청');
  assert.equal(x.prog, 100);
  assert.equal(tkExpected(x), 'u3');
  const r = step('완료', '', 'u3');
  assert.equal(x.status, '완료');
  assert.match(r.ok ? r.message : '', /업무 실적 100% 반영/);
  assert.deepEqual(liveOf(task(), x), { status: '완료', pct: 100 });
  assert.equal(ticketDoneInfo(x)?.by, 'u3');
});

test('검토자가 있으면: 검토 통과 → 승인자 최종 승인. 반려는 사유 필수 + 진행률 90 이하', () => {
  let x = issue({}, 'u2');
  for (const to of ['접수', '진행중', '검토요청'] as const) { const r = moveTicket(x, to, '', 'u1', TODAY, nameOf); assert.ok(r.ok); if (r.ok) x = r.ticket; }
  assert.equal(tkExpected(x), 'u2');
  assert.equal(ticketActions(x)[0][1], '검토 통과');
  let r = moveTicket(x, '완료', '', 'u2', TODAY, nameOf);
  assert.ok(r.ok && r.ticket.status === '검토요청' && r.ticket.reviewOk);
  if (r.ok) x = r.ticket;
  assert.equal(tkExpected(x), 'u3');
  assert.equal(moveTicket(x, '진행중', '', 'u3', TODAY, nameOf).ok, false);
  r = moveTicket(x, '진행중', '화면 다시', 'u3', TODAY, nameOf);
  assert.ok(r.ok && r.ticket.prog === 90 && !r.ticket.reviewOk);
  assert.match(r.ok ? r.ticket.hist.at(-1)!.text : '', /반려 — 재작업 요청 — 화면 다시/);
});

test('대리 처리 표시 · 취소하면 다시 발행 가능 · 보류·재오픈 사유 필수', () => {
  let x = issue();
  const r = moveTicket(x, '접수', '', 'u4', TODAY, nameOf);
  assert.ok(r.ok && /대리 처리/.test(r.ticket.hist.at(-1)!.text));
  if (r.ok) x = r.ticket;
  assert.equal(moveTicket(x, '보류', '', 'u1', TODAY, nameOf).ok, false);
  const c = moveTicket(issue(), '취소', '', 'u4', TODAY, nameOf);
  assert.ok(c.ok && !/대리/.test(c.ticket.hist.at(-1)!.text));
  if (c.ok) assert.equal(taskTicketIndex([c.ticket]).size, 0);
});

test('세부 작업 티켓: 마감 = 예정일 → 업무 종료일, 완료하면 세부 작업도 완료', () => {
  const s: PmSubtask = { id: 's1', taskId: 'P2|01-01', text: 'API 연결', assigneeId: 'u1', due: '', estHours: 0, done: false, doneDate: '', memo: '', createdBy: '', createdDate: TODAY, fromFp: false, order: 0, legacyKey: '' };
  let x = makeSubTicket('P2-0002', task(), s, ctx);
  assert.equal(x.due, '2026-11-30');
  assert.equal(x.parent, '자재 입고');
  assert.equal(taskTicketIndex([x]).size, 0); // 업무 티켓 색인에 안 들어감
  for (const to of ['접수', '진행중', '검토요청'] as const) { const r = moveTicket(x, to, '', 'u1', TODAY, nameOf); if (r.ok) x = r.ticket; }
  const r = moveTicket(x, '완료', '', 'u3', TODAY, nameOf);
  assert.ok(r.ok && r.subDone === true);
});

test('[수정] 반영: 담당이 바뀌면 발행으로 돌아가 다시 접수, 칸 기록', () => {
  let x = issue();
  const r0 = moveTicket(x, '접수', '', 'u1', TODAY, nameOf);
  if (r0.ok) x = r0.ticket;
  const r = applyTicketDraft(x, { assigneeId: 'u4', reviewerId: '', approverId: 'u3', prio: '높음', due: '2026-12-05' }, 'u3', TODAY, nameOf, '2026-11-30');
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.changed, 3);
  assert.equal(r.ticket.status, '발행');
  assert.deepEqual(r.ticket.watcherIds, ['u1']);
  assert.match(r.ticket.hist.map((h) => h.text).join('\n'), /업무 종료일 2026-11-30 초과/);
  assert.equal(applyTicketDraft(x, { assigneeId: 'u1', reviewerId: 'u3', approverId: 'u3', prio: '보통', due: '2026-11-30' }, 'u3', TODAY, nameOf, '').ok, false);
});

test('칸 기록 합치기: 같은 날 같은 사람이 연달아 → 한 줄, 원래 값으로 돌아오면 줄 삭제', () => {
  const H: PmTicketHist[] = [];
  pushFieldHist(H, 'prio', '우선순위', '보통', '높음', 'u1', TODAY);
  pushFieldHist(H, 'prio', '우선순위', '높음', '긴급', 'u1', TODAY);
  assert.equal(H.length, 1);
  assert.equal(H[0].text, '우선순위 보통 → 긴급');
  pushFieldHist(H, 'prio', '우선순위', '긴급', '보통', 'u1', TODAY);
  assert.equal(H.length, 0);
  const x = setTicketProg({ ...issue(), status: '접수' }, 30, 'u1', TODAY);
  assert.equal(x.status, '진행중');
});

test('업무를 고치면 티켓도: 이름·종료일(마감이 옛 종료일이면 자동), 아니면 일정 변경 표시', () => {
  const x = issue();
  const n = syncTicketWithTask(x, task(), task({ name: '자재 입고 화면', end: '2026-12-10' }), 'u4', TODAY)!;
  assert.equal(n.title, '자재 입고 화면');
  assert.equal(n.due, '2026-12-10');
  const y = syncTicketWithTask({ ...x, due: '2026-11-28' }, task(), task({ end: '2026-12-10' }), 'u4', TODAY)!;
  assert.equal(y.taskChange, '일정 변경');
  assert.equal(syncTicketWithTask(x, task(), task(), 'u4', TODAY), null);
});

test('목록 거르기·숫자·담당별·마감 경과', () => {
  const a = issue();
  const b = { ...issue(), no: 'P2-0002', status: '취소' as const };
  const c = { ...issue(), no: 'P2-0003', assigneeId: 'u4', due: '2026-11-01', status: '진행중' as const };
  const ts = [a, b, c];
  assert.deepEqual(filterTickets(ts, TICKET_FILTER_DEFAULT, TODAY).map((x) => x.no), ['P2-0001', 'P2-0003']);
  assert.deepEqual(filterTickets(ts, { ...TICKET_FILTER_DEFAULT, st: '취소' }, TODAY).map((x) => x.no), ['P2-0002']);
  assert.deepEqual(filterTickets(ts, { ...TICKET_FILTER_DEFAULT, st: 'late' }, TODAY).map((x) => x.no), ['P2-0003']);
  assert.equal(tkLate(c, TODAY), true);
  const st = ticketStats(ts, TODAY);
  assert.equal(st.total, 2);
  assert.equal(st.issued, 1);
  assert.equal(st.late, 1);
  assert.deepEqual(openByAssignee(ts, TODAY).map(([k]) => k), ['u1', 'u4']);
  assert.match(ticketCsv([a], () => ({ company: '신광', biz: '부처' }), nameOf), /^﻿"Issue Key".*\r\n"P2-0001","자재 입고"/s);
});

test('발행 추천: 미완료 · 티켓 없음 · 시작 ≤ 오늘+7, 미리보기는 오늘과 가까운 순', () => {
  const ts = [task({ id: 'a', start: '2026-11-25' }), task({ id: 'b', start: '2026-12-20' }), task({ id: 'c', start: '2026-11-01' }), task({ id: 'd', start: '' })];
  const live = new Map(ts.map((t) => [t.id, liveOf(t)]));
  const r = ticketRecommend(ts, live, new Set(['c']), TODAY);
  assert.deepEqual(r.rec.map((t) => t.id), ['a']);
});

test('옛 업무 티켓은 업무 색인에 안 들어감', () => {
  const x = { ...issue(), taskId: '', legacyKey: 'P2|5.24' };
  assert.equal(pmTicketSchema.safeParse(x).success, true);
  assert.equal(taskTicketIndex([x]).size, 0);
});

test('검수 반영: 보류 → 작업 재개는 누가 해도 (대리 처리) 안 붙음 · 처리 중 거르기 = 접수 + 진행중', () => {
  const held = { ...issue(), status: '보류' as const };
  const r = moveTicket(held, '진행중', '', 'u4', TODAY, nameOf);
  assert.equal(r.ok && r.ticket.hist.at(-1)!.text, '작업 재개');
  const ts = (['발행', '접수', '진행중', '보류', '완료'] as const).map((s, i) => ({ ...issue(), no: `P2-000${i + 1}`, status: s }));
  assert.deepEqual(filterTickets(ts, { ...TICKET_FILTER_DEFAULT, st: 'doing' }, TODAY).map((x) => x.status), ['접수', '진행중']);
  assert.equal(filterTickets(ts, { ...TICKET_FILTER_DEFAULT, st: 'all' }, TODAY).length, 5, '발행된 티켓 = 완료 포함');
});
