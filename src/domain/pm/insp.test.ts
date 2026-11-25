import assert from 'node:assert/strict';
import test from 'node:test';
import { liveOf, type Live } from './rules';
import { pmProjectSchema, pmTaskSchema, type PmGovRecord, type PmTask } from './schema';
import { siteCtxOf } from './site';
import { inspBoard, inspInfo, inspSpan } from './insp';

/**
 * 점검 · 감리 대비 규칙 (데모 inspInfo) — 협약 기간 · 점검 일정이 있는 **테스트용 작은 데이터** (§0.1-1). 오늘 = 2026-11-25.
 */
const TODAY = '2026-11-25';
const T = (o: Partial<PmTask> & { code: string }): PmTask => pmTaskSchema.parse({ id: `P9|${o.code}`, projectId: 'P9', name: `업무 ${o.code}`, stage: '구축', ...o });
const rec = (itemId: string, v: string, date: string, items: PmGovRecord['items'] = []): PmGovRecord =>
  ({ id: `P9|${itemId}`, projectId: 'P9', itemId, v, date, by: 'pm', memo: '', fix: '', items, bulk: '' });
function info(p: { start: string; end: string; biz?: string; bidRes?: '' | '탈락' }, tasks: PmTask[], gov: PmGovRecord[] = [], sub = new Set<string>()) {
  const proj = pmProjectSchema.parse({ id: 'P9', company: '테스트', biz: p.biz ?? '정부일반형', start: p.start, end: p.end, bidRes: p.bidRes ?? '' });
  const liveMap = new Map<string, Live>(tasks.map((t) => [t.id, liveOf(t)]));
  const c = siteCtxOf(proj, { tasks, liveMap, plans: {}, gov, planChecks: [], govLinks: [], agreements: [], baselines: [], issues: [] }, TODAY);
  return inspInfo(c, undefined, (t) => (sub.has(t.code) ? '제출완료' : '미작성'));
}

test('중간점검: 업무 목록 일정이 규정(협약 후 3개월)보다 늦음 · 점검 전 지연 업무 → 주의 (14일 넘게 남음)', () => {
  const x = info({ start: '2026-09-01', end: '2027-02-28' }, [
    T({ code: 'm', name: '중간점검 대응', start: '2026-12-10', end: '2026-12-20' }),
    T({ code: 'a', start: '2026-11-01', end: '2026-11-20' }), // 지연, 점검 전
    T({ code: 'b', start: '2026-12-01', end: '2027-01-20' }), // 점검 뒤 마감 — 세지 않음
  ])!;
  assert.equal(x.g?.id, 'g_mid');
  assert.deepEqual([x.g?.due, x.g?.lawDue, x.days], ['2026-12-20', '2026-12-01', 25]);
  assert.deepEqual(x.probs, ['점검 일정이 규정(12/1)보다 19일 늦음', '지연 업무 1']);
  assert.equal(x.lv, 'warn');
  assert.equal(x.dev, null, '계획서 없음 → 약속 기능 비교 안 함');
  assert.equal(x.recBtn, false);
});

test('보완 판정 → 다음 점검 = 보완 재점검, 지적 사항 미조치 · 지난 점검 판정', () => {
  const x = info({ start: '2026-08-01', end: '2027-02-28' }, [], [rec('g_mid', '보완', '2026-11-20', [
    { id: 'GI1', text: '화면 오류', whoId: 'u1', st: '조치 전', hist: [] },
    { id: 'GI2', text: '보고서 보강', whoId: 'u1', st: '확인', hist: [] },
  ])])!;
  assert.deepEqual([x.g?.id, x.g?.due, x.days], ['g_mid_fix', '2026-12-20', 25]);
  assert.deepEqual(x.last, { nm: '중간점검', v: '보완', d: '2026-11-20' });
  assert.deepEqual(x.gi.map((it) => [it.id, it.pnm]), [['GI1', '중간점검']], '확인된 것은 뺌');
  assert.deepEqual(x.probs, ['보완 미조치 1']);
  assert.equal(x.lv, 'warn');
});

test('최종점검 60일 안: 최종점검 준비 기록 없음 · 산출물 미제출이 문제 · 14일 안이면 위험', () => {
  const ts = [
    T({ code: 'o1', output: '운영현황보고서', start: '2026-11-01', end: '2026-12-30' }),
    T({ code: 'o2', output: '시험 결과서', start: '2026-11-01', end: '2026-12-30' }),
    T({ code: 'o3', output: '착수계', stage: '협약 이전' }), // 협약 이전 — 대상 아님
  ];
  const x = info({ start: '2026-06-01', end: '2026-12-01' }, ts, [rec('g_mid', '계속', '2026-09-01')], new Set(['o2']))!;
  assert.deepEqual([x.g?.id, x.g?.due, x.days, x.isAudit], ['g_audit', '2027-01-14', 50, true]);
  assert.deepEqual([x.outs.length, x.outLeft.map((t) => t.code)], [2, ['o1']]);
  assert.deepEqual(x.probs, ['최종점검 준비 안 끝남', '산출물 미제출 1']);
  assert.equal(x.lv, 'warn');
  // 최종점검 준비를 기록하면 그 문제는 빠짐
  const y = info({ start: '2026-06-01', end: '2026-12-01' }, ts, [rec('g_mid', '계속', '2026-09-01'), rec('g_ready', '', '2026-11-20')], new Set(['o1', 'o2']))!;
  assert.deepEqual([y.readyOk, y.probs, y.lv], [true, [], 'ok']);
  // 14일 안 → 위험
  const z = info({ start: '2026-06-01', end: '2026-11-01' }, ts, [rec('g_mid', '계속', '2026-09-01')])!;
  assert.deepEqual([z.g?.due, z.days, z.lv], ['2026-12-15', 20, 'warn']);
  const w = info({ start: '2026-06-01', end: '2026-10-20' }, ts, [rec('g_mid', '계속', '2026-09-01')])!;
  assert.deepEqual([w.days, w.lv], [8, 'bad']);
});

test('점검을 모두 마친 사업 · 점검 대상 아님(정부사업 아님 · 탈락 · 협약 기간 없음) · 일정 띠', () => {
  const done = info({ start: '2026-01-01', end: '2026-06-30' }, [], [rec('g_mid', '계속', '2026-04-01'), rec('g_audit', '적정', '2026-08-01')])!;
  assert.deepEqual([done.g, done.lv, done.last], [null, 'none', { nm: '최종점검 (감리)', v: '적정', d: '2026-08-01' }]);
  assert.equal(info({ start: '2026-01-01', end: '2026-12-31', biz: '자율형공장' }, []), null);
  assert.equal(info({ start: '2026-01-01', end: '2026-12-31', bidRes: '탈락' }, []), null);
  assert.equal(info({ start: '', end: '' }, []), null);
  const b = inspBoard([done]);
  assert.deepEqual([b.up.length, b.fin.length], [0, 1]);
  const s = inspSpan(TODAY);
  assert.deepEqual([s.a, s.b, s.mons[0], s.mons.at(-1)?.[1]], ['2026-10-26', '2027-06-13', [(6 / 230) * 100, '11월'], '6월']);
  assert.equal(s.P(TODAY), (30 / 230) * 100);
});
