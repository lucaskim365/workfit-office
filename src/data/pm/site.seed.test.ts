import assert from 'node:assert/strict';
import test from 'node:test';
import { liveOf, type Live } from '@/domain/pm/rules';
import { fnLinks, fnSt, siteBrief, siteCtxOf, siteStage, stageBuckets, sumDeadlines, type SiteInputs } from '@/domain/pm/site';
import { SEED_BASE_DATE, seedPlanFunctions, seedPlans, seedProjects, seedTasks } from './seed';

/**
 * 3단계 확인 숫자 — 데모(같은 내장 데이터, 기록 0건)를 2026-11-25 에 띄워 `siteBrief`·`siteStage`·`sumDeadlines` 로 직접 뽑은 값.
 * (데모 화면: 2주 안 기한 1 · 지난 기한 31 · 도입기업 챙길 일 14 · 보완 0 · 협약변경 0 · 2주 넘게 갱신 없음 0)
 */
const TODAY = '2026-11-25';
const tasks = seedTasks();
const liveMap = new Map<string, Live>(tasks.map((t) => [t.id, liveOf(t)]));
const X: SiteInputs = { tasks, liveMap, plans: seedPlans(), gov: [], planChecks: [], govLinks: [], agreements: [], baselines: [], issues: [] };
const projects = seedProjects();
const ctx = (k: string) => siteCtxOf(projects.find((p) => p.id === k)!, X, TODAY);
const brief = (k: string) => siteBrief(ctx(k), SEED_BASE_DATE);
const KS = ['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13'];

test('통합 사업 현황 숫자: 2주 안 1 · 지난 31 · 도입기업 챙길 일 14 · 보완 0 · 협약변경 0 · 갱신 없음 0', () => {
  const B = KS.map(brief);
  const sum = (f: (b: ReturnType<typeof brief>) => number) => B.reduce((a, b) => a + f(b), 0);
  assert.equal(sum((b) => b.soon.length), 1);
  assert.equal(sum((b) => b.past.length), 31);
  assert.equal(sum((b) => b.buyer.length), 14);
  assert.equal(sum((b) => b.fix.length), 0);
  assert.equal(B.filter((b) => b.agr).length, 0);
  assert.equal(B.filter((b) => b.stale).length, 0);
});

test('사업별 지난 기한 · 점수 · 필수 TASK 빠짐 (데모 siteBrief 값)', () => {
  const want: Record<string, [number, number, number | null]> = {
    P2: [7, 78, 4], P3: [4, 48, 4], P4: [0, 0, null], P5: [7, 78, 4], P6: [3, 38, 4], P7: [3, 42, 4], P8: [3, 38, 4], P9: [4, 48, 4],
    P10: [0, 0, null], P11: [0, 0, null], P12: [0, 0, null], P13: [0, 0, null],
  };
  for (const k of KS) {
    const b = brief(k);
    assert.deepEqual([b.past.length, b.score, b.miss], want[k], k);
  }
  assert.deepEqual(brief('P2').past.map((x) => `${x.src}|${x.id}|${x.due}`), [
    '관리기준|g_start|2026-07-15', '관리기준|g_bond|2026-07-15', '계획서 약속|edu0|2026-07-31', '계획서 약속|edu1|2026-07-31',
    '계획서 약속|edu2|2026-07-31', '계획서 약속|edu3|2026-07-31', '관리기준|g_mid|2026-10-01',
  ]);
  assert.deepEqual(brief('P2').buyer.map((x) => x.id), ['g_start', 'g_mid']);
});

test('다음 기한: 효광(AI) 중간점검 11/25 (내부 11/18), 신광 최종점검 준비 3/1, 만도 3/31', () => {
  const n7 = brief('P7').next!;
  assert.deepEqual([n7.id, n7.due, n7.inner], ['g_mid', '2026-11-25', '2026-11-18']);
  assert.deepEqual(brief('P7').soon.map((x) => x.id), ['g_mid']);
  assert.equal(brief('P2').next!.due, '2027-03-01');
  assert.equal(brief('P8').next!.due, '2027-03-31');
  assert.equal(brief('P4').next, undefined);
});

test('기한 목록 순서 (신광 25건, 날짜 없는 성과지표 근거자료는 맨 뒤) · 저스템 교육 1건은 계획서에 이미 함', () => {
  const dl = sumDeadlines(ctx('P2')).map((x) => [x.src, x.id, x.due, x.inner ?? '', x.side, x.done ? 1 : 0].join('|'));
  assert.equal(dl.length, 25);
  assert.equal(dl[0], '관리기준|g_start|2026-07-15|2026-07-08|buyer|0');
  assert.equal(dl[8], '계획서 약속|uedu|2027-03-31||both|0');
  assert.equal(dl[24], '계획서 약속|kpiBase|||both|0');
  assert.ok(sumDeadlines(ctx('P6')).some((x) => x.id === 'edu0' && x.done));
});

test('사업 단계: 정부사업 = 구축 · 착수계 완료 체크 안 됨(빨강), 한일 = 구축, AX 4개 = 마무리 · 종료 준비', () => {
  for (const k of ['P2', 'P3', 'P5', 'P6', 'P7', 'P8', 'P9']) assert.deepEqual((({ n, sub, bad }) => [n, sub, bad])(siteStage(ctx(k))), ['구축', '착수계 완료 체크 안 됨', true], k);
  assert.deepEqual((({ n, sub, bad }) => [n, sub, bad])(siteStage(ctx('P4'))), ['구축', '', false]);
  for (const k of ['P10', 'P11', 'P12', 'P13']) assert.deepEqual((({ n, sub, bad }) => [n, sub, bad])(siteStage(ctx(k))), ['마무리', '종료 준비', false], k);
});

test('사업 상태: 업무 있는 정부사업 = 착수 전(계획 0%), 업무 없는 사업 = 준비 · 진척 7.133', () => {
  assert.equal(brief('P2').status, '착수 전');
  assert.equal(Number(brief('P2').stats.act.toFixed(3)), 7.133);
  assert.equal(brief('P9').status, '준비');
});

test('사업별 화면: 단계별 업무 수 · 평균 실적 · 단계 기간 (데모 stageBuckets · siteStage.per)', () => {
  const want: Record<string, string> = {
    P2: '0/0 0/0 72/21 0/0 0/0', P3: '0/0 0/0 60/10 0/0 0/0', P4: '0/0 0/0 0/0 0/0 0/0', P5: '0/0 0/0 60/13 0/0 0/0', P6: '0/0 0/0 43/0 0/0 0/0',
    P7: '0/0 0/0 63/3 0/0 0/0', P8: '0/0 0/0 40/0 0/0 0/0', P9: '0/0 0/0 0/0 0/0 0/0', P10: '0/0 0/0 0/0 0/0 0/0',
  };
  for (const [k, w] of Object.entries(want)) {
    const B = stageBuckets(ctx(k));
    assert.equal(B.map((b) => `${b.n}/${b.p}`).join(' '), w, k);
    assert.equal(B.reduce((a, b) => a + b.late + b.on, 0), 0, k);
  }
  assert.equal(siteStage(ctx('P2')).per.join('|'), '|7/1~7/15|~2/28|3/1~6/27|6/27~');
  assert.equal(siteStage(ctx('P7')).per.join('|'), '|8/25~9/8|~4/23|4/24~8/20|8/20~');
});

test('계획서 약속 기능: 기능 수 · 추가/변경 중 연결 없음 (데모 fnLinks — 새 업무 번호가 01-01 꼴이라 모두 연결 없음)', () => {
  const FN = seedPlanFunctions();
  const want: Record<string, [number, number]> = { P2: [51, 36], P3: [43, 38], P5: [48, 40], P6: [26, 26], P7: [58, 56], P8: [17, 17], P9: [46, 29] };
  for (const [k, [n, none]] of Object.entries(want)) {
    const c = ctx(k);
    const fl = fnLinks(c, FN[k])!;
    assert.equal(fl.length, n, k);
    const dev = fl.filter((f) => f.kind !== '기존');
    assert.equal(dev.length, none, k);
    assert.ok(dev.every((f) => fnSt(c, f) === '연결 없음'), k);
  }
  assert.equal(fnLinks(ctx('P4'), FN.P4), null);
});

test('4단계 산출물: 내장 업무 목록엔 산출물 칸이 있는 업무가 사업마다 0건 (데모 pDoc · inspInfo outs 와 같음)', async () => {
  const { docTasks } = await import('@/domain/pm/doc');
  for (const k of KS) assert.equal(docTasks(tasks.filter((t) => t.projectId === k)).length, 0, k);
});

test('4단계 점검 · 감리 대비 (데모 inspInfo · pInsp 값, 11/25 · 기록 0건)', async () => {
  const { inspInfo, inspBoard } = await import('@/domain/pm/insp');
  const fns = seedPlanFunctions();
  const all = KS.map((k) => inspInfo(ctx(k), fns[k], () => '미작성')).filter((x) => x !== null);
  // [사업, 다음 점검, 점검일, D-day, 신호, 약속 기능 완료/전체 · 연결 없음, 실적 반올림, 문제]
  assert.deepEqual(all.map((x) => [x.c.p.id, x.g?.id, x.g?.due, x.days, x.lv, `${x.fnDone}/${x.dev?.length} ${x.fnNone.length}`, Math.round(x.ps.act), x.probs.join('|')]), [
    ['P2', 'g_mid', '2026-10-01', -55, 'bad', '0/36 36', 7, '점검일 지남 — 결과 기록 필요'],
    ['P3', 'g_mid', '2026-10-01', -55, 'bad', '0/38 38', 4, '점검일 지남 — 결과 기록 필요'],
    ['P5', 'g_mid', '2026-10-01', -55, 'bad', '0/40 40', 6, '점검일 지남 — 결과 기록 필요'],
    ['P6', 'g_mid', '2026-10-01', -55, 'bad', '0/26 26', 0, '점검일 지남 — 결과 기록 필요'],
    ['P7', 'g_mid', '2026-11-25', 0, 'ok', '0/56 56', 1, ''],
    ['P8', 'g_mid', '2026-11-01', -24, 'bad', '0/17 17', 0, '점검일 지남 — 결과 기록 필요'],
    ['P9', 'g_mid', '2026-11-14', -11, 'bad', '0/29 29', 0, '점검일 지남 — 결과 기록 필요'],
  ]);
  const b = inspBoard(all);
  // 데모 화면: 위험 6 · 주의 0 · 30일 안 7건(지난 것 포함) · 보완 미조치 0건, 점검일 순 = 신광 · 효광 · 꽃샘 · 저스템 · 만도 · 삼광 · 효광AI
  assert.deepEqual([b.nBad, b.nWarn, b.soon, b.nGi, b.fin.length], [6, 0, 7, 0, 0]);
  assert.deepEqual(b.up.map((x) => x.c.p.id), ['P2', 'P3', 'P5', 'P6', 'P8', 'P9', 'P7']);
});

test('5단계 주간 진행률 · 보고서 (데모 pWeekCheck · docReport 값, 11/25 · 기록 0건)', async () => {
  const { wcBoard, weekReport } = await import('@/domain/pm/weekly');
  const X = { tasks, liveMap, projects, today: TODAY, logs: [], checks: [], tickets: [], baseDate: SEED_BASE_DATE, sitePm: () => '' };
  // 업무가 있는 사업 6개 모두 갱신할 업무 0건 (날짜가 없어서) → 100%
  const B = wcBoard(KS.map(ctx), X, '박명규', () => [], true, []);
  assert.deepEqual(B.list.map((r) => [r.c.p.id, r.n]), [['P2', 0], ['P3', 0], ['P5', 0], ['P6', 0], ['P7', 0], ['P8', 0]]);
  assert.deepEqual([B.tot, B.pct, B.fin], [0, 100, 6]);
  // 보고서 1번: 진척(반올림) · 계획 · 완료 / 전체 · 지연 · 상태 · 11월 4주차
  const R = (k: string) => { const r = weekReport(ctx(k), 0, { tickets: [], issues: [], meetings: [], hours: () => 0 }); return [Math.round(r.act), Math.round(r.plan), r.done, r.n, r.late.length, r.wkNo]; };
  assert.deepEqual([R('P2'), R('P3'), R('P7')], [[7, 0, 15, 72, 0, 4], [4, 0, 6, 60, 0, 4], [1, 0, 2, 63, 0, 4]]);
});
