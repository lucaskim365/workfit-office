import assert from 'node:assert/strict';
import test from 'node:test';
import { liveOf, mdAvg, mdAvgRaw, mdSum, groupsOf, projectCard, filterTasks, PM_FILTER_DEFAULT, tabCounts, doneInfoOf, type Live, type FilterCtx } from '@/domain/pm/rules';
import type { PmTask } from '@/domain/pm/schema';
import { createPmStore } from './pm.store';
import { seedProjects, seedTasks, seedFunctions, seedSubtasks } from './seed';

/**
 * 1단계 확인 숫자 — 데모 내장 데이터로 계산한 값과 같아야 한다 (§5 1단계 확인 칸).
 * 카드 표시는 정수, 계산값은 소수 셋째 자리.
 */
const TODAY = '2026-11-24';
const tasks = seedTasks();
const live = new Map<string, Live>(tasks.map((t) => [t.id, liveOf(t)]));
const of = (k: string) => tasks.filter((t) => t.projectId === k);

test('업무 338건 = 신광 72 · 효광 60 · 꽃샘 60 · 저스템 43 · 효광AI 63 · 만도 40', () => {
  assert.equal(tasks.length, 338);
  assert.deepEqual(['P2', 'P3', 'P5', 'P6', 'P7', 'P8'].map((k) => of(k).length), [72, 60, 60, 43, 63, 40]);
});

test('사업 12개 — 데모처럼 P1 에이스메디칼은 목록에서 뺌 (DROP_K)', () => {
  const ps = seedProjects();
  assert.equal(ps.length, 12);
  assert.ok(!ps.some((p) => p.id === 'P1'));
});

test('사업 카드 진행률: 정수 7/4/6/0/1/0, 계산값 7.133/3.811/6.339/0/1.476/0', () => {
  const ks = ['P2', 'P3', 'P5', 'P6', 'P7', 'P8'];
  assert.deepEqual(ks.map((k) => mdAvg(of(k), live)), [7, 4, 6, 0, 1, 0]);
  assert.deepEqual(ks.map((k) => Number(mdAvgRaw(of(k), live).toFixed(3))), [7.133, 3.811, 6.339, 0, 1.476, 0]);
});

test('신광 공수 378.5MD, 01 자재관리 업무 9 · 48MD · 5% (계산 5.208)', () => {
  assert.equal(mdSum(of('P2')), 378.5);
  const g = groupsOf(of('P2'), live).find((x) => x.group === '01 자재관리')!;
  assert.deepEqual([g.n, g.md, g.pct], [9, 48, 5]);
  const raw = mdAvgRaw(of('P2').filter((t) => t.group === '01 자재관리'), live);
  assert.equal(Number(raw.toFixed(3)), 5.208);
});

test('내장 데이터는 날짜·담당이 없다 → 진행 중·지연·2주 내·발행 추천 = 0, 담당 없음 = 미완료 전부', () => {
  const ctx: FilterCtx = { today: TODAY, liveMap: live, ticketed: new Set(), doneInfo: (t) => doneInfoOf(t, live.get(t.id)!, new Map(), []) };
  const c = tabCounts(tasks, PM_FILTER_DEFAULT, ctx, false);
  assert.deepEqual([c.now, c.late, c.soon, c.rec, c.done], [0, 0, 0, 0, 0]);
  // 최근 완료 = 0: 엑셀에서 완료로 들어온 31건은 완료 날짜가 없음
  assert.equal(tasks.filter((t) => t.actualPct >= 100).length, 31);
  const p2 = projectCard(seedProjects().find((p) => p.id === 'P2')!, of('P2'), live, TODAY);
  assert.equal(p2.noAssignee, 72 - 15);
  assert.equal(p2.now, 0);
  // 지금 업무: 날짜가 없으니 안 끝난 첫 묶음
  assert.equal(p2.current?.stage, p2.stages.find((s) => !s.allDone)?.stage);
  // 전체 탭(미완료) = 338 − 31
  assert.equal(filterTasks(tasks, PM_FILTER_DEFAULT, ctx).length, 338 - 31);
});

test('업무 없는 사업 카드 = 업무 0건 (화면은 "-" + "업무 목록 작성 전")', () => {
  const p4 = seedProjects().find((p) => p.id === 'P4')!;
  const c = projectCard(p4, of('P4'), live, TODAY);
  assert.equal(c.n, 0);
  assert.notEqual(c.timePct, null); // 사업 기간은 있음
});

test('세부 작업 미리 넣기 = FP 신규·변경만, 담당 비움', () => {
  const subs = seedSubtasks(seedFunctions(), TODAY);
  assert.ok(subs.length > 0);
  assert.ok(subs.every((s) => /^\[(신규|변경)\] /.test(s.text) && s.assigneeId === '' && s.fromFp));
  const fn = seedFunctions().find((f) => f.id === 'P2|01-01')!;
  assert.equal(subs.filter((s) => s.taskId === 'P2|01-01').length, fn.items.filter((i) => i.kind !== '재사용').length);
});

test('저장소: 켜질 때 기준선 "최초 계획"을 만든다 → 일정 변동 0건', async () => {
  const s = createPmStore(TODAY);
  const snap = await s.snapshot();
  assert.equal(snap.baselines.length, 6);
  assert.ok(snap.baselines.every((b) => b.label.startsWith('최초 계획') && b.date === TODAY));
});

test('저장소: 진행률 100 → 완료 기록, 완료 취소 → 이전 %', async () => {
  const s = createPmStore(TODAY);
  const id = 'P2|01-01';
  await s.setProgress(id, 40, '테스트', 'u1', TODAY);
  await s.setProgress(id, 100, 'TASK 완료 처리', 'u1', TODAY);
  let snap = await s.snapshot();
  const t = snap.tasks.find((x) => x.id === id) as PmTask;
  assert.equal(t.status, '완료');
  assert.deepEqual(snap.done.find((d) => d.id === id), { id, date: TODAY, by: 'u1', prevPct: 40 });
  await s.setProgress(id, 40, 'TASK 완료 취소', 'u1', TODAY);
  snap = await s.snapshot();
  assert.equal(snap.tasks.find((x) => x.id === id)!.status, '진행중');
  assert.equal(snap.done.length, 0);
  assert.equal(snap.logs.length, 3);
});

test('저장소: 번호를 바꾸면 세부 작업·기준선도 따라감', async () => {
  const s = createPmStore(TODAY);
  const snap = await s.snapshot();
  const t = snap.tasks.find((x) => x.id === 'P2|01-01')!;
  await s.updateTask(t.id, { ...t, id: 'P2|01-99', code: '01-99' }, 'u1');
  const after = await s.snapshot();
  assert.ok(after.subtasks.some((x) => x.taskId === 'P2|01-99'));
  assert.ok(!after.subtasks.some((x) => x.taskId === 'P2|01-01'));
  assert.ok(after.baselines.find((b) => b.id === 'P2')!.map['P2|01-99']);
  assert.match(after.logs[0].text, /번호 01-01 → 01-99/);
});
