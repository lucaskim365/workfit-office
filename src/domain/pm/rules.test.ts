import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyProgress, currentStage, doneInfoOf, filterTasks, liveOf, makeBaseline, planPct, prioOf, projectCard,
  PM_FILTER_DEFAULT, shortName, siteStatus, stagesOf, stripTitle, tabCounts, timePct, undoPct, varianceOf,
  type FilterCtx, type Live,
} from './rules';
import { pmTaskSchema, pmProjectSchema, type PmTask } from './schema';

/**
 * 계산·판정 규칙 — 날짜가 있는 **테스트용 작은 데이터**로 확인 (§5.1: 가짜 날짜는 테스트 안에서만).
 */
const TODAY = '2026-11-24';
const T = (o: Partial<PmTask> & { code: string }): PmTask =>
  pmTaskSchema.parse({ id: `P9|${o.code}`, projectId: 'P9', name: o.code, ...o });
const P = (o: Record<string, unknown> = {}) => pmProjectSchema.parse({ id: 'P9', company: '테스트', ...o });
const lmap = (ts: PmTask[]) => new Map<string, Live>(ts.map((t) => [t.id, liveOf(t)]));
const ctx = (ts: PmTask[], ticketed: string[] = []): FilterCtx => {
  const m = lmap(ts);
  return { today: TODAY, liveMap: m, ticketed: new Set(ticketed), doneInfo: (t) => doneInfoOf(t, m.get(t.id)!, new Map(), []) };
};

test('진행 중 = 시작 ≤ 오늘 ≤ 종료, 완료 여부는 안 봄 (상태 필터가 따로 거름)', () => {
  const ts = [
    T({ code: 'a', start: '2026-11-20', end: '2026-11-30' }),
    T({ code: 'b', start: '2026-11-20', end: '2026-11-30', actualPct: 100 }),
    T({ code: 'c', start: '2026-11-25', end: '2026-11-30' }),
  ];
  assert.deepEqual(filterTasks(ts, { ...PM_FILTER_DEFAULT, period: 'now' }, ctx(ts)).map((t) => t.code), ['a']);
  assert.deepEqual(filterTasks(ts, { ...PM_FILTER_DEFAULT, period: 'now', st: 'all' }, ctx(ts)).map((t) => t.code), ['a', 'b']);
});

test('지연 = 종료 < 오늘 이고 완료 아님', () => {
  const ts = [T({ code: 'a', end: '2026-11-23' }), T({ code: 'b', end: '2026-11-23', actualPct: 100 }), T({ code: 'c', end: TODAY })];
  assert.deepEqual(filterTasks(ts, { ...PM_FILTER_DEFAULT, period: 'late', st: 'all' }, ctx(ts)).map((t) => t.code), ['a']);
});

test('2주 내 시작 = 오늘 < 시작 ≤ 오늘+14', () => {
  const ts = [T({ code: 'a', start: TODAY }), T({ code: 'b', start: '2026-11-25' }), T({ code: 'c', start: '2026-12-08' }), T({ code: 'd', start: '2026-12-09' })];
  assert.deepEqual(filterTasks(ts, { ...PM_FILTER_DEFAULT, period: 'soon' }, ctx(ts)).map((t) => t.code), ['b', 'c']);
});

test('발행 추천 = 미완료 · 티켓 없음 · 시작 있음 · 시작 ≤ 오늘+7 (이미 시작한 것 포함)', () => {
  const ts = [
    T({ code: 'a', start: '2026-10-01' }),
    T({ code: 'b', start: '2026-12-01' }),
    T({ code: 'c', start: '2026-12-02' }),
    T({ code: 'd', start: '2026-11-01', actualPct: 100 }),
    T({ code: 'e', start: '2026-11-01' }),
    T({ code: 'f' }),
  ];
  assert.deepEqual(filterTasks(ts, { ...PM_FILTER_DEFAULT, period: 'rec' }, ctx(ts, ['P9|e'])).map((t) => t.code), ['a', 'b']);
});

test('최근 완료 = 완료 날짜 ≥ 오늘−14, 상태 필터 무시. 날짜 없는 완료(엑셀)는 안 나옴', () => {
  const ts = [T({ code: 'a', actualPct: 100 }), T({ code: 'b', actualPct: 100 }), T({ code: 'c', actualPct: 100 }), T({ code: 'd', actualPct: 100 })];
  const m = lmap(ts);
  const rec = new Map([
    ['P9|a', { id: 'P9|a', date: '2026-11-10', by: 'u', prevPct: 0 }],
    ['P9|b', { id: 'P9|b', date: '2026-11-09', by: 'u', prevPct: 0 }],
  ]);
  const logs = [{ id: 'l', projectId: 'P9', code: 'c', kind: '수정' as const, text: '실적 30% → 100% (x)', date: '2026-11-20', by: 'u' }];
  const c: FilterCtx = { today: TODAY, liveMap: m, ticketed: new Set(), doneInfo: (t) => doneInfoOf(t, m.get(t.id)!, rec, logs) };
  assert.deepEqual(filterTasks(ts, { ...PM_FILTER_DEFAULT, period: 'done' }, c).map((t) => t.code), ['a', 'c']);
  assert.deepEqual(doneInfoOf(ts[2], m.get('P9|c')!, rec, logs), { date: '2026-11-20', by: 'u', prevPct: 30 });
  assert.deepEqual(doneInfoOf(ts[3], m.get('P9|d')!, rec, logs), { date: '', by: '', prevPct: null });
});

test('탭 숫자: 보드 보기면 상태 무관으로 셈 → 탭 숫자 = 보드 카드 수', () => {
  const ts = [T({ code: 'a', start: '2026-11-20', end: '2026-11-30' }), T({ code: 'b', start: '2026-11-20', end: '2026-11-30', actualPct: 100 })];
  assert.equal(tabCounts(ts, PM_FILTER_DEFAULT, ctx(ts), false).now, 1);
  assert.equal(tabCounts(ts, PM_FILTER_DEFAULT, ctx(ts), true).now, 2);
});

test('기간 경과율 (tPct): (오늘−시작)/(종료−시작), 0~100, 날짜 없으면 null', () => {
  assert.equal(timePct('2026-11-14', '2026-12-04', TODAY), 50);
  assert.equal(timePct('2026-12-01', '2026-12-31', TODAY), 0);
  assert.equal(timePct('2026-01-01', '2026-02-01', TODAY), 100);
  assert.equal(timePct('', '2026-02-01', TODAY), null);
});

test('계획% (planP) 은 양 끝 날 포함 — tPct 와 다르다', () => {
  // 11/23~11/26 (4일) 중 11/23·11/24 지남 → 2/4 = 50%
  assert.equal(planPct(T({ code: 'a', start: '2026-11-23', end: '2026-11-26' }), TODAY), 50);
  assert.equal(timePct('2026-11-23', '2026-11-26', TODAY), 33);
  assert.equal(planPct(T({ code: 'b', start: TODAY, end: TODAY }), TODAY), 100);
});

test('사업 상태: 업무 0 준비 / 계획 ≤0 착수 전 / −10%p 지연 / <0 소폭지연 / +5%p 선행 / 정상 / 종료', () => {
  const p = P();
  const live = (ts: PmTask[]) => lmap(ts);
  assert.equal(siteStatus(p, [], new Map(), TODAY), '준비');
  assert.equal(siteStatus(P({ closed: true }), [], new Map(), TODAY), '종료');
  const fut = [T({ code: 'a', start: '2026-12-01', end: '2026-12-10' })];
  assert.equal(siteStatus(p, fut, live(fut), TODAY), '착수 전');
  const half = (ap: number) => [T({ code: 'a', start: '2026-11-23', end: '2026-11-26', actualPct: ap })]; // 계획 50%
  assert.equal(siteStatus(p, half(40), live(half(40)), TODAY), '지연');
  assert.equal(siteStatus(p, half(45), live(half(45)), TODAY), '소폭지연');
  assert.equal(siteStatus(p, half(50), live(half(50)), TODAY), '정상');
  assert.equal(siteStatus(p, half(55), live(half(55)), TODAY), '선행');
  assert.equal(siteStatus(p, half(100), live(half(100)), TODAY), '완료');
});

test('지금 업무: 시작한 안 끝난 단계 중 마지막, 없으면 안 끝난 첫 단계, 다 끝나면 null', () => {
  const ts = [
    T({ code: '1', stage: 'A', start: '2026-11-01', end: '2026-11-10', actualPct: 100 }),
    T({ code: '2', stage: 'B', start: '2026-11-05', end: '2026-11-30' }),
    T({ code: '3', stage: 'C', start: '2026-11-20', end: '2026-12-30' }),
    T({ code: '4', stage: 'D', start: '2026-12-01', end: '2026-12-30' }),
  ];
  const m = lmap(ts);
  assert.equal(currentStage(stagesOf(ts, m, TODAY), TODAY)?.stage, 'C');
  const noDates = ts.map((t) => ({ ...t, start: '', end: '' }));
  assert.equal(currentStage(stagesOf(noDates, lmap(noDates), TODAY), TODAY)?.stage, 'B');
  const allDone = ts.map((t) => ({ ...t, actualPct: 100 }));
  assert.equal(currentStage(stagesOf(allDone, lmap(allDone), TODAY), TODAY), null);
});

test('사업 카드: 7일 내 마감 · 담당 없음은 미완료만, MD 가중(md 없으면 1)', () => {
  const ts = [
    T({ code: 'a', end: '2026-11-30', md: 3, actualPct: 50 }),
    T({ code: 'b', end: '2026-12-02', assigneeIds: ['u1'], actualPct: 100 }),
    T({ code: 'c', end: '2026-12-01' }),
  ];
  const c = projectCard(P(), ts, lmap(ts), TODAY);
  assert.equal(c.due7, 2);
  assert.equal(c.noAssignee, 2);
  assert.equal(c.pctRaw, (3 * 50 + 100) / 5);
  assert.equal(c.pct, 50);
});

test('진행률 입력 → 상태: ≥100 완료 · >0 진행중 · 0이면 완료였으면 진행중 아니면 그대로', () => {
  const t = T({ code: 'a', status: '계획' });
  assert.equal(applyProgress(t, 100, TODAY, 'u').status, '완료');
  assert.equal(applyProgress(t, 30, TODAY, 'u').status, '진행중');
  assert.equal(applyProgress(t, 0, TODAY, 'u').status, '계획');
  assert.equal(applyProgress({ ...t, status: '완료', actualPct: 100 }, 0, TODAY, 'u').status, '진행중');
  assert.deepEqual(applyProgress({ ...t, actualPct: 60 }, 100, TODAY, 'u').done, { id: 'P9|a', date: TODAY, by: 'u', prevPct: 60 });
  assert.equal(applyProgress({ ...t, actualPct: 100 }, 80, TODAY, 'u').done, 'remove');
  assert.equal(undoPct({ date: '', by: '', prevPct: null }), 90);
  assert.equal(undoPct({ date: '', by: '', prevPct: 40 }), 40);
});

test('티켓 반영 (wbsLive): 티켓 완료 → 100, 진행 중 → max(업무%, 티켓%)', () => {
  const t = T({ code: 'a', actualPct: 30 });
  assert.deepEqual(liveOf(t, { taskId: t.id, status: '완료', prog: 50 }), { status: '완료', pct: 100 });
  assert.deepEqual(liveOf(t, { taskId: t.id, status: '진행중', prog: 50 }), { status: '진행중', pct: 50 });
  assert.deepEqual(liveOf(t, { taskId: t.id, status: '발행', prog: 0 }), { status: '계획', pct: 30 });
});

test('우선순위: 지연 > 7일 내 마감 > 진행 중 > 예정', () => {
  const l = (t: PmTask) => liveOf(t);
  const a = T({ code: 'a', end: '2026-11-23' });
  const b = T({ code: 'b', start: '2026-11-01', end: '2026-11-28' });
  const c = T({ code: 'c', start: '2026-11-01', end: '2026-12-28' });
  const d = T({ code: 'd', start: '2026-12-01', end: '2026-12-28' });
  assert.deepEqual([a, b, c, d].map((t) => prioOf(t, l(t), TODAY)), ['지연', '7일 내 마감', '진행 중', '예정']);
});

test('기준선 대비 변동: 늦춰짐·당겨짐·추가·삭제, 마지막 업무 종료 변화', () => {
  const before = [T({ code: 'a', end: '2026-12-01' }), T({ code: 'b', end: '2026-12-10' }), T({ code: 'c', end: '2026-12-05' })];
  const b = makeBaseline('P9', before, '최초 계획', TODAY, '');
  const after = [T({ code: 'a', end: '2026-12-04' }), T({ code: 'b', end: '2026-12-08' }), T({ code: 'd', end: '2026-12-20' })];
  const v = varianceOf(b, after);
  assert.deepEqual([v.late, v.early, v.added, v.removed], [1, 1, 1, 1]);
  assert.deepEqual(v.rows.map((r) => r.kind), ['late', 'add', 'del', 'early']);
  assert.equal(v.endDiff, 10);
  assert.equal(varianceOf(makeBaseline('P9', after, 'x', TODAY, ''), after).rows.length, 0);
});

test('줄인 이름: 같은 업체가 여럿이면 (사업유형), 부처협업형은 그냥 업체명', () => {
  const a = P({ id: 'P3', biz: '부처협업형(산업보안)', company: '㈜효광' });
  const b = P({ id: 'P7', biz: '제조AI', company: '㈜효광' });
  assert.equal(shortName(a, [a, b]), '효광');
  assert.equal(shortName(b, [a, b]), '효광(AI)');
  assert.equal(stripTitle('박명규 부장'), '박명규');
});
