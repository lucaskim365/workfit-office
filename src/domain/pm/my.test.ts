import assert from 'node:assert/strict';
import test from 'node:test';
import { liveOf, type Live } from './rules';
import { pmActionSchema, pmChangeRequestSchema, pmIssueSchema, pmProjectSchema, pmTaskSchema, type PmChangeLog, type PmTask } from './schema';
import { myInbox, mySites, myUpdList, myWork, nextMilestone, pageOf, updBatch, updWhat, type UpdItem } from './my';
import type { PmTicket } from './ticket';

/**
 * 내 업무 규칙 — 날짜·담당이 있는 **테스트용 작은 데이터**로 확인 (가짜 날짜는 테스트 안에서만, §0.1-1).
 * 오늘 = 2026-11-25 (수) → 이번 주 11/23~11/29.
 */
const TODAY = '2026-11-25';
const T = (o: Partial<PmTask> & { code: string }): PmTask =>
  pmTaskSchema.parse({ id: `${o.projectId ?? 'P9'}|${o.code}`, projectId: 'P9', name: o.code, ...o });
const projects = [
  pmProjectSchema.parse({ id: 'P9', company: '테스트', pmUserId: 'pm' }),
  pmProjectSchema.parse({ id: 'P3', company: '둘째' }),
  pmProjectSchema.parse({ id: 'P5', company: '탈락', bidRes: '탈락' }),
];
const X = (tasks: PmTask[]) => ({ tasks, liveMap: new Map<string, Live>(tasks.map((t) => [t.id, liveOf(t)])), projects, today: TODAY });
const tk = (o: Partial<PmTicket>): PmTicket => ({ no: 'P9-0001', projectId: 'P9', taskId: '', subtaskId: '', status: '진행중', assigneeId: '', reviewerId: '', approverId: '', reviewOk: false, hist: [], ...o } as PmTicket);

test('내 업무 나누기: 지금 할 일 · 나중에 할 일 · 2주 내 시작, 숫자', () => {
  const ts = [
    T({ code: 'a', assigneeIds: ['me'], start: '2026-11-01', end: '2026-11-20', actualPct: 10 }), // 지연
    T({ code: 'b', assigneeIds: ['me'], start: '2026-11-20', end: '2026-11-28', actualPct: 50 }), // 7일 내 마감
    T({ code: 'c', assigneeIds: ['me'], start: '2026-11-20', end: '2026-12-20', actualPct: 30 }), // 진행 중
    T({ code: 'd', assigneeIds: ['me'], start: '2026-12-01', end: '2026-12-31' }), // 2주 내 시작
    T({ code: 'e', assigneeIds: ['me'], start: '2027-01-10', end: '2027-01-31' }), // 먼 예정 — 어디에도 없음
    T({ code: 'f', assigneeIds: ['me'], start: '2026-11-01', end: '2026-11-10', actualPct: 100 }), // 완료
    T({ code: 'g', assigneeIds: ['me'], stage: '협약 이전', start: '2026-11-01', end: '2026-11-10' }), // 집계 제외
    T({ code: 'h', assigneeIds: ['other'], start: '2026-11-01', end: '2026-11-10' }), // 남의 업무
  ];
  const w = myWork('me', X(ts), ['P9|c']);
  assert.deepEqual(w.todo.map((t) => t.code), ['b', 'a'], '진행 중 우선 = 진행률 높은 순');
  assert.deepEqual(w.later.map((t) => t.code), ['c']);
  assert.deepEqual(w.next.map((t) => t.code), ['d']);
  assert.deepEqual([w.nLate, w.nWeek, w.all.length, w.open.length], [1, 1, 6, 5]);
  assert.deepEqual(myWork('me', X(ts), [], 'late').todo.map((t) => t.code), ['a', 'b', 'c'], '지연 우선 = 마감 순');
  // 나중에 할 일로 내려도 지연 숫자는 지금 할 일에서만 셈 (데모 그대로)
  assert.equal(myWork('me', X(ts), ['P9|a']).nLate, 0);
});

test('페이지: 7건씩, 범위를 넘으면 마지막 페이지', () => {
  const a = Array.from({ length: 15 }, (_, i) => i);
  assert.deepEqual([pageOf(a, 1).rows.length, pageOf(a, 3).rows, pageOf(a, 9).page, pageOf([], 4).page], [7, [14], 3, 1]);
});

test('처리할 일: 내 티켓 · 승인 대기(티켓 검토 · 마일스톤) · 이슈 · 액션', () => {
  const ts = [
    T({ code: 'm', milestone: true, stage: '구축', start: '2026-11-01', end: '2026-11-20', actualPct: 100 }),
    T({ code: 'm2', milestone: true, stage: '구축', start: '2026-11-01', end: '2026-11-30', actualPct: 100 }),
    T({ code: 'x', stage: '구축', start: '2026-11-01', end: '2026-11-25' }), // m2 전에 끝나야 하는데 미완료
  ];
  const tickets = [
    tk({ no: 'P9-0001', assigneeId: 'me' }),
    tk({ no: 'P9-0002', assigneeId: 'me', status: '완료' }),
    tk({ no: 'P9-0003', assigneeId: 'u', status: '검토요청', reviewerId: 'me' }),
    tk({ no: 'P9-0004', assigneeId: 'u', status: '검토요청', reviewerId: 'r', reviewOk: true, approverId: 'me' }),
    tk({ no: 'P9-0005', assigneeId: 'u', status: '검토요청', reviewerId: 'r', approverId: 'me' }), // 검토자 차례
  ];
  const ib = myInbox('pm', {
    ...X(ts), tickets, msOk: new Map(), pmOf: (p) => [p.pmUserId].filter(Boolean),
    issues: [pmIssueSchema.parse({ id: 'i1', projectId: 'P9', title: '이슈', ownerId: 'pm' }), pmIssueSchema.parse({ id: 'i2', projectId: 'P9', title: '해결', ownerId: 'pm', status: '해결' })],
    actions: [pmActionSchema.parse({ id: 'a1', text: '할 일', whoId: 'pm', due: '2026-11-30' }), pmActionSchema.parse({ id: 'a2', text: '끝', whoId: 'pm', done: true })],
    // CR: 내가 PM인 사업의 검토중만 (4단계, 데모 appr cr)
    crs: [pmChangeRequestSchema.parse({ id: 'CR-001', projectId: 'P9', title: '검토중' }), pmChangeRequestSchema.parse({ id: 'CR-002', projectId: 'P9', title: '승인됨', status: '승인' }), pmChangeRequestSchema.parse({ id: 'CR-003', projectId: 'P3', title: '남의 사업' })],
  });
  assert.deepEqual(ib.appr.map((a) => (a.kind === 'ms' ? a.t.code : a.kind === 'tk' ? a.x.no : a.c.id)), ['m', 'CR-001'], 'PM 사업 마일스톤 — 앞선 업무가 남은 m2 는 아직 · 검토중 CR');
  assert.deepEqual([ib.issues.length, ib.actions.length, ib.total], [1, 1, 4]);
  const mine = myInbox('me', { ...X(ts), tickets, msOk: new Map(), pmOf: () => [], issues: [], actions: [] });
  assert.deepEqual(mine.tickets.map((x) => x.no), ['P9-0001']);
  assert.deepEqual(mine.appr.map((a) => (a.kind === 'tk' ? a.x.no : '')), ['P9-0003', 'P9-0004']);
  // 승인하면 빠짐
  const ok = myInbox('pm', { ...X(ts), tickets: [], msOk: new Map([['P9|m', { id: 'P9|m', date: TODAY, by: 'pm' }]]), pmOf: (p) => [p.pmUserId], issues: [], actions: [] });
  assert.equal(ok.appr.length, 0);
  // 탈락 사업의 마일스톤은 승인 대기에 안 뜸 (데모 liveSites)
  const drop = myInbox('pm', { ...X(ts.map((t) => ({ ...t, projectId: 'P5', id: `P5|${t.code}` }))), projects: [pmProjectSchema.parse({ id: 'P5', company: '탈락', bidRes: '탈락', pmUserId: 'pm' })], tickets: [], msOk: new Map(), pmOf: (p) => [p.pmUserId], issues: [], actions: [] });
  assert.equal(drop.appr.length, 0);
});

test('내가 참여하는 사업 · 다음 마일스톤', () => {
  const ts = [
    T({ code: 'a', assigneeIds: ['me'], start: '2026-11-01', end: '2026-11-20' }),
    T({ code: 'b', assigneeIds: ['me'], start: '2026-11-01', end: '2026-11-10', actualPct: 100 }),
    T({ code: 'c', projectId: 'P3', assigneeIds: ['me'], start: '2026-12-01', end: '2026-12-10' }),
    T({ code: 'm1', milestone: true, end: '2026-11-10', actualPct: 100 }),
    T({ code: 'm2', milestone: true, end: '2026-12-31' }),
  ];
  const x = X(ts);
  const r = mySites(myWork('me', x, []), x);
  assert.deepEqual(r.map((s) => [s.projectId, s.n, s.done, s.late, s.board]), [['P9', 2, 1, 1, 1], ['P3', 1, 0, 0, 0]]);
  assert.equal(nextMilestone(ts, x.liveMap)?.code, 'm2');
});

test('진행률 갱신: 묻는 업무 · 책임자 · 이번 주 갱신하면 갱신함', () => {
  const ts = [
    T({ code: 'late', assigneeIds: ['me'], start: '2026-11-01', end: '2026-11-20' }), // 마감 지남
    T({ code: 'week', assigneeIds: ['me'], start: '2026-11-01', end: '2026-11-27' }), // 이번 주 마감
    T({ code: 'stale', assigneeIds: ['me'], start: '2026-10-01', end: '2026-12-31' }), // 갱신일(11/01)부터 2주 넘음
    T({ code: 'fresh', assigneeIds: ['me'], start: '2026-10-01', end: '2026-12-31' }), // 11/20 에 기록 → 안 물음
    T({ code: 'future', assigneeIds: ['me'], start: '2026-12-01', end: '2026-12-31' }), // 시작 전
    T({ code: 'nobody', start: '2026-11-01', end: '2026-11-20' }), // 담당 없음 → 사업 PM
  ];
  const logs: PmChangeLog[] = [
    { id: 'l1', projectId: 'P9', code: 'fresh', kind: '수정', text: '실적 10% → 20% (내 업무에서 기록)', date: '2026-11-20', by: 'me' },
    { id: 'l2', projectId: 'P9', code: 'week', kind: '수정', text: '실적 20% → 40% (내 업무에서 기록)', date: '2026-11-24', by: 'me' },
  ];
  const U = { ...X(ts), logs, checks: [{ id: 'w|P9|late', projectId: 'P9', taskId: 'P9|late', week: '2026-11-23', date: TODAY, by: 'me' }], tickets: [], baseDate: '2026-11-01', sitePm: () => 'pm' };
  const L = myUpdList('me', U);
  assert.deepEqual(L.map((x) => [x.t.code, x.why, x.done]), [['late', 'late', true], ['week', 'week', true], ['stale', 'stale', false]]);
  assert.deepEqual(myUpdList('pm', U).map((x) => x.t.code), ['nobody']);
  assert.equal(updWhat(ts[1], U), '20% → 40%');
  assert.equal(updWhat(ts[0], U), '변동 없음');
});

test('진행률 갱신 묶음: 5건씩, 다음 묶음은 처음 보는 것 먼저', () => {
  const ts = Array.from({ length: 7 }, (_, i) => T({ code: `t${i}`, end: `2026-11-1${i}` }));
  const L: UpdItem[] = ts.map((t) => ({ t, why: 'late', done: false, last: '', who: 'me' }));
  const a = updBatch(L, { list: [], i: 0 });
  assert.deepEqual([a.B.length, a.rest], [5, 2]);
  const b = updBatch(L, { list: a.P.list, i: 1 });
  assert.deepEqual(b.B.map((id) => id.split('|')[1]), ['t5', 't6', 't0', 't1', 't2']);
  assert.equal(b.prevLeft, 2, '앞 묶음에서 못한 t3 · t4');
});

test('진행률 갱신 화면 흐름: 그릴 때마다 묶음을 기억 → 갱신한 줄이 남고 1/2 → 2/2, 다음 · 이전 5건', () => {
  const ts = Array.from({ length: 7 }, (_, i) => T({ code: `t${i}`, end: `2026-11-1${i}` }));
  let L: UpdItem[] = ts.map((t) => ({ t, why: 'late', done: false, last: '', who: 'me' }));
  // 화면(UpdCard)은 그릴 때 돌려받은 P 를 상태에 넣는다
  let P = { list: [] as string[][], i: 0 };
  const draw = () => { const r = updBatch(L, P); P = r.P; return { ...r, bDone: r.B.filter((id) => L.find((x) => x.t.id === id)!.done).length }; };
  const first = draw().B;
  const mark = (id: string) => { L = L.map((x) => (x.t.id === id ? { ...x, done: true } : x)); };
  mark(first[0]);
  let r = draw();
  assert.deepEqual(r.B, first, '갱신한 줄도 그 묶음에 그대로');
  assert.equal(r.bDone, 1);
  first.slice(1).forEach(mark);
  r = draw();
  assert.deepEqual([r.B.length, r.bDone, r.rest], [5, 5, 2], '다 해도 줄은 그대로, 남은 2건은 [다음 5건]으로');
  P = { list: P.list, i: 1 };
  r = draw();
  assert.deepEqual(r.B.map((id) => id.split('|')[1]), ['t5', 't6']);
  P = { list: P.list, i: 0 };
  assert.deepEqual(draw().B, first, '[← 이전 5건]으로 돌아가도 같은 묶음');
});
