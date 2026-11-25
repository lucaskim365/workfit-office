import assert from 'node:assert/strict';
import test from 'node:test';
import { liveOf, type Live } from './rules';
import { pmIssueSchema, pmMeetingSchema, pmProjectSchema, pmTaskSchema, type PmTask } from './schema';
import { siteCtxOf, siteUpdates } from './site';
import { wcBoard, wcPeople, weekReport } from './weekly';
import type { UpdInputs } from './my';

/** 주간 진행률 · 보고서 규칙 (데모 pWeekCheck · docReport) — 테스트용 작은 데이터 (§0.1-1). 오늘 = 2026-11-25 (수), 이번 주 11/23~11/29 */
const TODAY = '2026-11-25';
const T = (o: Partial<PmTask> & { code: string }): PmTask => pmTaskSchema.parse({ id: `P9|${o.code}`, projectId: 'P9', name: `업무 ${o.code}`, stage: '구축', ...o });
const P = pmProjectSchema.parse({ id: 'P9', company: '테스트', biz: '정부일반형', pmUserId: 'pm', start: '2026-07-01', end: '2027-03-31' });
const ctx = (ts: PmTask[], reports = [] as Parameters<typeof siteCtxOf>[1]['reports']) =>
  siteCtxOf(P, { tasks: ts, liveMap: new Map<string, Live>(ts.map((t) => [t.id, liveOf(t)])), plans: {}, gov: [], planChecks: [], govLinks: [], agreements: [], baselines: [], issues: [], reports }, TODAY);
const U = (ts: PmTask[], checks: UpdInputs['checks'] = []): UpdInputs => ({
  tasks: ts, liveMap: new Map(ts.map((t) => [t.id, liveOf(t)])), projects: [P], today: TODAY, logs: [], checks, tickets: [], baseDate: '2026-11-17', sitePm: () => 'pm',
});

test('진행률 체크인: 갱신할 업무(마감 지남 · 이번 주 마감 · 2주 넘게) 중 이번 주 갱신한 비율 · 사람별', () => {
  const ts = [
    T({ code: 'a', assigneeIds: ['u1'], start: '2026-11-01', end: '2026-11-20' }), // 마감 지남
    T({ code: 'b', assigneeIds: ['u1'], start: '2026-11-01', end: '2026-11-27' }), // 이번 주 마감
    T({ code: 'c', assigneeIds: ['u2'], start: '2026-11-01', end: '2026-11-26' }), // 이번 주 마감 · 갱신함
    T({ code: 'd', start: '2026-11-01', end: '2027-01-31' }), // 담당 없음 → PM, 2주 넘게 (기준일 11/17 → 8일, 아직 아님)
    T({ code: 'e', assigneeIds: ['u1'], start: '2026-12-01', end: '2026-12-31' }), // 시작 전 — 대상 아님
  ];
  const c = ctx(ts);
  const B = wcBoard([c], U(ts, [{ id: 'x', projectId: 'P9', taskId: 'P9|c', week: '2026-11-23', date: '2026-11-24', by: 'u2' }]), 'pm', () => ['pm'], false, []);
  assert.deepEqual([B.mine, B.tot, B.okAll, B.pct, B.fin], [true, 3, 1, 33, 0]);
  const pp = wcPeople(B.list[0].items);
  assert.deepEqual(pp.map((r) => [r.who, r.all.length, r.left.length, r.late]), [['u1', 2, 2, 1], ['u2', 1, 0, 0]]);
  // PM 이 아니면 전체 사업
  assert.equal(wcBoard([c], U(ts), 'nobody', () => ['pm'], false, []).mine, false);
});

test('주간 보고서: 금주 진행 · 금주 완료 · 미해결 이슈 · 금주 회의 결정 · 차주 시작 · 그 달 몇째 주', () => {
  const ts = [
    T({ code: 'p', start: '2026-11-20', end: '2026-12-10', actualPct: 30 }), // 진행
    T({ code: 'f', start: '2026-11-01', end: '2026-11-24', actualPct: 100, status: '완료', output: '설계서' }), // 금주 완료
    T({ code: 'n', start: '2026-12-01', end: '2026-12-20' }), // 차주 시작
    T({ code: 'x', start: '2026-12-15', end: '2026-12-20' }), // 차주 밖
  ];
  const R = weekReport(ctx(ts), 0, {
    tickets: [],
    issues: [pmIssueSchema.parse({ id: 'I-1', projectId: 'P9', title: '열린 이슈' }), pmIssueSchema.parse({ id: 'I-2', projectId: 'P9', title: '해결', status: '해결' })],
    meetings: [pmMeetingSchema.parse({ id: 'M1', projectId: 'P9', title: '주간 회의', date: '2026-11-24', decision: '범위 확정' }), pmMeetingSchema.parse({ id: 'M2', projectId: 'P9', title: '지난주', date: '2026-11-20' })],
    hours: () => 6,
  });
  assert.deepEqual([R.ws, R.we, R.nws, R.nwe, R.wkNo], ['2026-11-23', '2026-11-29', '2026-11-30', '2026-12-06', 4]);
  assert.deepEqual(R.prog.map((t) => t.code), ['p']);
  assert.deepEqual(R.doneRows, [['f', '업무 f', '설계서']]);
  assert.deepEqual([R.iss.map((i) => i.id), R.mts.map((m) => m.id), R.next.map((t) => t.code), R.hours, R.done, R.n], [['I-1'], ['M1'], ['n'], 6, 1, 4]);
  assert.equal(weekReport(ctx(ts), -1, { tickets: [], issues: [], meetings: [], hours: () => 0 }).ws, '2026-11-16', '이전 주');
});

test('최근 업데이트에 주간 특이사항 (note / 협조 요청)', () => {
  const c = ctx([], [{ id: 'P9|2026-11-23', projectId: 'P9', week: '2026-11-23', note: '시연 완료', req: 'BOM 엑셀', by: 'pm', at: '2026-11-24' }]);
  assert.deepEqual(siteUpdates(c), [{ d: '2026-11-24', tag: '주간 특이사항', who: 'pm', txt: '시연 완료 / 협조 요청: BOM 엑셀' }]);
});
