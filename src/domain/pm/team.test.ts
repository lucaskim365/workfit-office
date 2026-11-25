import assert from 'node:assert/strict';
import test from 'node:test';
import { liveOf, type Live } from './rules';
import { pmProjectSchema, pmTaskSchema, type PmTask } from './schema';
import {
  DEV_TEAM_DEPT, hourRange, hourSummary, lastActivity, loadCell, loadOrder, loadWeeks, personTasks, reassignList, teamRows,
} from './team';
import type { PmTicket } from './ticket';

/**
 * 팀 현황 규칙 — 날짜·담당이 있는 **테스트용 작은 데이터**로 확인 (가짜 날짜는 테스트 안에서만, §0.1-1).
 * 오늘 = 2026-11-25 (수) → 이번 주 11/23~11/29.
 */
const TODAY = '2026-11-25';
const T = (o: Partial<PmTask> & { code: string }): PmTask =>
  pmTaskSchema.parse({ id: `${o.projectId ?? 'P9'}|${o.code}`, projectId: 'P9', name: o.code, ...o });
const projects = [pmProjectSchema.parse({ id: 'P9', company: '테스트' }), pmProjectSchema.parse({ id: 'P3', company: '둘째' }), pmProjectSchema.parse({ id: 'P5', company: '탈락', bidRes: '탈락' })];
const X = (tasks: PmTask[]) => ({ tasks, liveMap: new Map<string, Live>(tasks.map((t) => [t.id, liveOf(t)])), projects, today: TODAY });
const tk = (o: Partial<PmTicket>): PmTicket => ({ no: 'P9-0001', projectId: 'P9', status: '진행중', assigneeId: '', hist: [], ...o } as PmTicket);

test('팀원 카드: 지연 · 7일 내 마감 · 진행 중 · 완료 숫자, 지연 많은 순', () => {
  const ts = [
    T({ code: 'a', assigneeIds: ['u1'], start: '2026-11-01', end: '2026-11-20' }), // 지연
    T({ code: 'b', assigneeIds: ['u1'], start: '2026-11-20', end: '2026-11-28' }), // 진행 중 · 7일 내
    T({ code: 'c', assigneeIds: ['u2'], start: '2026-11-20', end: '2026-12-20' }), // 진행 중
    T({ code: 'd', assigneeIds: ['u2'], start: '2026-11-01', end: '2026-11-10', actualPct: 100 }), // 완료
    T({ code: 'e', assigneeIds: ['u2'], stage: '협약 이전', start: '2026-11-01', end: '2026-11-10' }), // 집계 제외
    T({ code: 'f', projectId: 'P5', assigneeIds: ['u2'], start: '2026-11-01', end: '2026-11-10' }), // 탈락 사업 제외
  ];
  const rows = teamRows([{ id: 'u2', dept: '' }, { id: 'u1', dept: '' }, { id: 'u3', dept: '' }], { ...X(ts), tickets: [], logs: [] }, 'all');
  assert.deepEqual(rows.map((r) => r.id), ['u1', 'u2']);
  const [u1, u2] = rows;
  assert.deepEqual([u1.late, u1.week, u1.period, u1.doneN, u1.ts.length], [1, 1, 1, 0, 2]);
  assert.deepEqual([u2.late, u2.week, u2.period, u2.doneN, u2.ts.length], [0, 0, 1, 1, 1]);
  assert.equal(u1.stale, true, '급한 일이 있는데 업데이트 기록 없음');
});

test('팀원 카드: 전체 사업이면 개발팀은 업무가 없어도, 열린 티켓 담당도 보임', () => {
  const rows = teamRows([{ id: 'd1', dept: DEV_TEAM_DEPT }, { id: 'x', dept: '경영지원' }, { id: 't', dept: '' }], { ...X([]), tickets: [tk({ assigneeId: 't' })], logs: [] }, 'all');
  assert.deepEqual(rows.map((r) => r.id).sort(), ['d1', 't']);
  const only = teamRows([{ id: 'd1', dept: DEV_TEAM_DEPT }], { ...X([]), tickets: [], logs: [] }, 'P9');
  assert.equal(only.length, 0, '사업을 고르면 개발팀이라도 그 사업 업무가 없으면 안 보임');
});

test('마지막 업데이트 = 변경 이력 · 티켓 처리 중 가장 최근, 7일 넘으면 회색', () => {
  const logs = [{ id: 'l', projectId: 'P9', code: 'a', kind: '수정' as const, text: '', date: '2026-11-10', by: 'u1' }];
  const tickets = [tk({ hist: [{ date: '2026-11-15', by: 'u1', text: '' }] as PmTicket['hist'] })];
  assert.equal(lastActivity('u1', logs, tickets), '2026-11-15');
  const ts = [T({ code: 'a', assigneeIds: ['u1'], start: '2026-11-20', end: '2026-11-28' })];
  const [r] = teamRows([{ id: 'u1', dept: '' }], { ...X(ts), tickets, logs }, 'all');
  assert.equal(r.stale, true, '11/15 → 10일 전');
  const [r2] = teamRows([{ id: 'u1', dept: '' }], { ...X(ts), tickets, logs, lastMore: () => ['2026-11-24'] }, 'all');
  assert.equal(r2.stale, false);
});

test('사람별 업무 팝업: 탭 숫자 · 사업별 숫자 · 급한 순', () => {
  const ts = [
    T({ code: 'a', assigneeIds: ['u1'], start: '2026-11-20', end: '2026-12-20' }),
    T({ code: 'b', assigneeIds: ['u1'], start: '2026-11-01', end: '2026-11-20' }),
    T({ code: 'c', projectId: 'P3', assigneeIds: ['u1'], start: '2026-11-20', end: '2026-11-27' }),
    T({ code: 'd', assigneeIds: ['u1'], end: '2026-11-01', actualPct: 100 }),
  ];
  const r = personTasks('u1', X(ts), 'all', 'all');
  assert.deepEqual(r.list.map((t) => t.code), ['b', 'c', 'a'], '지연 → 7일 내 마감 → 진행 중');
  assert.deepEqual(r.counts, { all: 3, now: 2, late: 1, week: 1, done: 1 });
  assert.deepEqual(r.ks, ['P3', 'P9']);
  assert.equal(personTasks('u1', X(ts), 'P3', 'all').list.length, 1);
});

test('앞으로 4주: 그 주에 마감되는 것만 칸에, 지연은 따로, 기간만 걸치면 run', () => {
  const ts = [
    T({ code: 'a', assigneeIds: ['u1'], start: '2026-11-20', end: '2026-11-27' }), // 이번 주 마감
    T({ code: 'b', assigneeIds: ['u1'], start: '2026-11-20', end: '2026-12-10' }), // 3주째(12/7~13) 마감, 1·2주는 run
    T({ code: 'c', assigneeIds: ['u1'], start: '2026-11-01', end: '2026-11-20' }), // 지연
    T({ code: 'd', assigneeIds: ['u1'], start: '2026-11-20' }), // 종료 없음 → 안 셈
  ];
  const { ws, m } = loadWeeks(X(ts));
  assert.deepEqual(ws.map((w) => w.s), ['2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14']);
  const r = m.get('u1')!;
  assert.deepEqual(r.w, [1, 0, 1, 0]);
  assert.deepEqual(r.run, [2, 1, 1, 0]);
  assert.equal(r.late, 1);
  assert.deepEqual(r.by.get('P9'), [1, 0, 1, 0]);
});

test('칸 표시와 재배정 검토 대상', () => {
  assert.deepEqual(loadCell(0, 8).lv, 'none');
  assert.deepEqual(loadCell(4, 8).lv, 'low');
  assert.deepEqual(loadCell(5, 8).lv, 'mid');
  assert.deepEqual(loadCell(8, 8).text, '마감 8건 · 꽉 참');
  assert.deepEqual(loadCell(10, 8).text, '마감 10건 · 2건 초과');
  const ts = [
    ...[1, 2, 3].map((i) => T({ code: `a${i}`, assigneeIds: ['u1'], start: '2026-11-20', end: '2026-11-27' })),
    T({ code: 'b', assigneeIds: ['u2'], start: '2026-11-20', end: '2026-12-02' }),
    T({ code: 'c', assigneeIds: ['u3'], start: '2026-11-20', end: '2026-12-25' }),
  ];
  const { m } = loadWeeks(X(ts));
  assert.deepEqual(loadOrder(['u2', 'u1', 'x'], m), ['u1', 'u2']);
  const R = reassignList(['u1', 'u2', 'u3'], m, 2, ts);
  assert.equal(R.length, 1);
  assert.deepEqual(R[0].top, { projectId: 'P9', n: 3 });
  assert.deepEqual(R[0].cand, { id: 'u3', due2: 0 }, '같은 사업 참여자 중 2주 마감이 가장 적은 사람');
});

test('투입 시간: 기간 · 사람별 · 사업별 합계', () => {
  assert.deepEqual(hourRange('week', TODAY).slice(0, 2), ['2026-11-23', '2026-11-29']);
  assert.deepEqual(hourRange('lastweek', TODAY).slice(0, 2), ['2026-11-16', '2026-11-22']);
  assert.deepEqual(hourRange('month', TODAY).slice(0, 2), ['2026-11-01', TODAY]);
  const rows = [
    { who: 'u1', d: '2026-11-24', h: 3, projectId: 'P9', txt: 'a' },
    { who: 'u1', d: '2026-11-25', h: 2, projectId: '', txt: 'b' },
    { who: 'u2', d: '2026-11-24', h: 4, projectId: 'P3', txt: 'c' },
    { who: 'u2', d: '2026-11-10', h: 9, projectId: 'P3', txt: '기간 밖' },
  ];
  const s = hourSummary(rows, '2026-11-23', '2026-11-29');
  assert.equal(s.total, 9);
  assert.deepEqual(s.ks, ['P3', 'P9', ''], '사업 번호 순, 사내 · 기타는 맨 뒤');
  assert.deepEqual(s.ppl.map((p) => [p.w, p.h, p.days]), [['u1', 5, 2], ['u2', 4, 1]]);
  assert.deepEqual(s.top, { k: 'P3', h: 4 });
});
