import assert from 'node:assert/strict';
import test from 'node:test';
import { liveOf, type Live } from '@/domain/pm/rules';
import { siteBrief, siteCtxOf, siteStage, sumDeadlines, type SiteInputs } from '@/domain/pm/site';
import { SEED_BASE_DATE, seedPlans, seedProjects, seedTasks } from './seed';

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
