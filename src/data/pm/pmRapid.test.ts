import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { liveOf } from '@/domain/pm/rules';
import { planEditable, planMarkTask } from '@/domain/pm/plan';
import type { PmPlanItem } from '@/domain/pm/schema';
import { makeTaskTicket } from '@/domain/pm/ticket';
import { derivePm, ticketProgMake } from '@/features/pm/usePm';
import { planAt, planCtxOf, planDayEdit, planHas, planKey } from '@/features/pm/usePmPlan';
import { createPmStore, pmBase, PmLatestError, PmSkippedError, type PmStore } from './pm.store';
import { PmStaleWindowError } from './pmSync';
import { reread, seededDb } from './pmTestStores';

/**
 * G2 (검수 ④, 설계 5.7.17 G2) — 같은 사람이 '화면 값 통째 저장'을 잇달아 누름: 첫 저장 왕복 중에 둘째를 눌러도
 * 둘째는 차례 때 저장소 최신 상태에서 다시 계산 → 둘 다 남음 (사용자 결정 (가) 11/27).
 * 첫 저장은 쓰기를 늦춰(setWriteDelay) 둘째가 줄을 서게 한다. 화면 = 첫 저장 전 스냅숏(peek)으로 줄 열쇠를 만듦.
 */
const TODAY = '2026-11-25';
mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12) });
const ME = 'u1';
const nameOf = (id: string) => id;

async function two() {
  const db = seededDb(TODAY);
  const A = createPmStore(TODAY, { db });
  const B = createPmStore(TODAY, { db });
  await A.refresh(); await B.refresh();
  return { db, A, B };
}
/** 화면이 보여 주는 그날 목록 (저장소 지금 상태 = 첫 저장 전 화면) */
const screenOf = (s: PmStore) => planEditable(planCtxOf(derivePm(s.peek().snap)), ME, TODAY);
/** PlanView edit 과 같은 일: 화면 줄 i → 차례 때 최신 목록의 자리 */
const edit = (s: PmStore, fn: (a: PmPlanItem[], at: (i: number) => number) => void | false) => {
  const screen = screenOf(s);
  return s.latest('setPlanDay', planDayEdit(ME, TODAY, (a) => fn(a, (i) => planAt(a, planKey(screen, i)))));
};
const dayOf = async (db: Parameters<typeof reread>[0]) => (await reread(db, TODAY)).planDays.find((p) => p.id === `${ME}|${TODAY}`)?.items ?? [];
const p2 = (s: PmStore, i = 0) => s.peek().snap.tasks.filter((t) => t.projectId === 'P2')[i];

test('P1 · R14-a 메모 쓰고 나가며 바로 체크 — 첫 저장 중 둘째 저장: 둘 다 남음', async () => {
  const { db, A } = await two();
  await A.setPlanDay(ME, TODAY, [{ text: 'ZZ 일' }]);
  db.setWriteDelay(30);
  const r = await Promise.allSettled([edit(A, (a, at) => { a[at(0)].memo = '한 일 메모'; }), edit(A, (a, at) => { a[at(0)].done = true; })]);
  assert.deepEqual(r.map((x) => x.status), ['fulfilled', 'fulfilled']);
  const d = await dayOf(db);
  assert.equal(d[0].memo, '한 일 메모');
  assert.equal(d[0].done, true);
});

test('P1 · R14-c 티켓 진행률 화살표 키 11 → 12 → 13: 마지막 값 · 다 저장', async () => {
  const { db, A } = await two();
  const t = p2(A);
  await A.issueTickets([makeTaskTicket('P0-0000', { task: t, assigneeId: ME, prio: '보통', due: '2026-12-01' }, { reviewerId: '', approverId: '', memo: '' }, { today: TODAY, me: ME, approverOf: () => 'u3', nameOf, live: liveOf(t) })]);
  const no = A.peek().snap.tickets[0].no;
  await A.moveTicket(no, '접수', '', ME, nameOf);
  db.setWriteDelay(30);
  const r = await Promise.allSettled([11, 12, 13].map((n) => A.latest('putTicket', ticketProgMake(no, n, ME))));
  assert.deepEqual(r.map((x) => x.status), ['fulfilled', 'fulfilled', 'fulfilled']);
  assert.equal((await reread(db, TODAY)).tickets.find((x) => x.no === no)!.prog, 13);
});

test('P1 · M2 티켓이 접수 · 진행 중이 아니면 진행률 안 씀 + 안내', async () => {
  const { db, A } = await two();
  const t = p2(A);
  await A.issueTickets([makeTaskTicket('P0-0000', { task: t, assigneeId: ME, prio: '보통', due: '2026-12-01' }, { reviewerId: '', approverId: '', memo: '' }, { today: TODAY, me: ME, approverOf: () => 'u3', nameOf, live: liveOf(t) })]);
  const no = A.peek().snap.tickets[0].no;
  await assert.rejects(A.latest('putTicket', ticketProgMake(no, 40, ME)), (e) => e instanceof PmLatestError && /'발행' 이라 진행률을 바꾸지 않았습니다/.test((e as Error).message));
  assert.equal((await reread(db, TODAY)).tickets.find((x) => x.no === no)!.prog, 0);
});

test('P1 · [+ 오늘] 두 세부 작업 연달아 = 둘 다 · M3 같은 세부 작업 두 번 = 한 번만', async () => {
  const { db, A } = await two();
  const t = p2(A);
  const s1 = await A.addSubtask(t.id, 'ZZ 세부 1', ME, '', ME, TODAY);
  const s2 = await A.addSubtask(t.id, 'ZZ 세부 2', ME, '', ME, TODAY);
  const add = (id: string) => A.latest('setPlanDay', planDayEdit(ME, TODAY, (a) => { if (a.some((x) => x.subId === id)) return false; a.push({ taskId: t.id, subId: id }); }));
  db.setWriteDelay(30);
  await Promise.all([add(s1.id), add(s2.id), add(s1.id)]);
  const d = await dayOf(db);
  assert.deepEqual(d.filter((x) => x.subId).map((x) => x.subId).sort(), [s1.id, s2.id].sort());
});

test('P1 · 내 업무 두 업무 연달아 완료 → 오늘 계획 두 줄 다 체크', async () => {
  const { db, A } = await two();
  const [x, y] = [p2(A, 0), p2(A, 1)];
  await A.setPlanDay(ME, TODAY, [{ taskId: x.id }, { taskId: y.id }]);
  const mark = (id: string) => A.latest('setPlanDay', planDayEdit(ME, TODAY, (a) => { const r = planMarkTask(a, id, true); if (!r) return false; a.splice(0, a.length, ...r); }));
  db.setWriteDelay(30);
  await Promise.all([mark(x.id), mark(y.id)]);
  assert.deepEqual((await dayOf(db)).map((it) => it.done), [true, true]);
});

test('M5-ⓐ 첫 저장 = 윗줄 빼기 → 둘째 = 아랫줄 체크: 체크가 다른 줄에 붙지 않음', async () => {
  const { db, A } = await two();
  await A.setPlanDay(ME, TODAY, [{ text: 'ZZ 위' }, { text: 'ZZ 아래' }]);
  db.setWriteDelay(30);
  await Promise.all([edit(A, (a, at) => { a.splice(at(0), 1); }), edit(A, (a, at) => { a[at(1)].done = true; })]);
  assert.deepEqual((await dayOf(db)).map((it) => [it.text, !!it.done]), [['ZZ 아래', true]]);
});

test('M5-ⓑ 자동 초안을 처음 굳히는 날 — 첫 저장(메모) · 둘째(체크) 둘 다', async () => {
  const { db, A } = await two();
  const t = p2(A);
  await A.addSubtask(t.id, 'ZZ 오늘 마감', ME, TODAY, ME, TODAY); // 그날 저장 기록 없음 → 자동 초안에 들어옴
  assert.ok(!A.peek().snap.planDays.some((p) => p.id === `${ME}|${TODAY}`), '시험 전제: 저장 기록 없음');
  assert.ok(screenOf(A).length >= 1, '시험 전제: 자동 줄 있음');
  db.setWriteDelay(30);
  await Promise.all([edit(A, (a, at) => { a[at(0)].memo = 'ZZ 메모'; }), edit(A, (a, at) => { a[at(0)].done = true; })]);
  const d = await dayOf(db);
  assert.equal(d[0].memo, 'ZZ 메모');
  assert.equal(d[0].done, true);
  assert.ok(d.every((it) => !it.auto), '자동 표시는 떨어짐');
});

test('M5-ⓒ 체크 묶음(그날 계획 + 세부 작업 완료)을 연달아 두 줄', async () => {
  const { db, A } = await two();
  const t = p2(A);
  const s1 = await A.addSubtask(t.id, 'ZZ 1', ME, '', ME, TODAY);
  const s2 = await A.addSubtask(t.id, 'ZZ 2', ME, '', ME, TODAY);
  await A.setPlanDay(ME, TODAY, [{ taskId: t.id, subId: s1.id }, { taskId: t.id, subId: s2.id }]);
  db.setWriteDelay(30);
  const check = (i: number, id: string) => [edit(A, (a, at) => { a[at(i)].done = true; }), A.updateSubtask(id, { done: true }, ME)];
  await Promise.all([...check(0, s1.id), ...check(1, s2.id)]);
  const s = await reread(db, TODAY);
  assert.deepEqual(s.planDays.find((p) => p.id === `${ME}|${TODAY}`)!.items.map((x) => x.done), [true, true]);
  assert.deepEqual(s.subtasks.filter((x) => [s1.id, s2.id].includes(x.id)).map((x) => x.done), [true, true]);
});

test('M4 줄 열쇠 — 같은 글 두 줄 · 같은 업무 두 줄 · 반복 줄: 화면에서 고른 그 줄만', async () => {
  const { db, A } = await two();
  const t = p2(A);
  await A.setPlanDay(ME, TODAY, [{ text: '같음' }, { text: '같음' }, { taskId: t.id }, { taskId: t.id, text: '둘째' }, { text: '반복', rep: true }]);
  await edit(A, (a, at) => { a[at(1)].done = true; a[at(3)].memo = 'ZZ'; a[at(4)].hours = 2; });
  assert.deepEqual((await dayOf(db)).map((x) => [!!x.done, x.memo ?? '', x.hours ?? 0]), [[false, '', 0], [true, '', 0], [false, '', 0], [false, 'ZZ', 0], [false, '', 2]]);
  assert.ok(planHas([{ text: '같음' }], { text: '같음' }) && !planHas([{ text: '같음' }], { text: '다름' }));
});

test('M4 그 줄이 없어짐 (다른 탭이 뺌) → 쓰지 않고 "그 줄이 없어졌습니다"', async () => {
  const { db, A, B } = await two();
  await A.setPlanDay(ME, TODAY, [{ text: 'ZZ 1' }, { text: 'ZZ 2' }]);
  await B.refresh();
  const screen = screenOf(A);
  await B.latest('setPlanDay', planDayEdit(ME, TODAY, (a) => { a.splice(1, 1); }));
  await A.refresh();
  await assert.rejects(A.latest('setPlanDay', planDayEdit(ME, TODAY, (a) => { a[planAt(a, planKey(screen, 1))].done = true; })), /그 줄이 없어졌습니다/);
  assert.deepEqual((await dayOf(db)).map((x) => [x.text, !!x.done]), [['ZZ 1', false]]);
});

test('P2 다른 탭(같은 사람)이 다른 줄을 고침 — 저장소가 모르는 변경이어도 ①에 걸리면 다시 읽고 합침: 둘 다 남음 · 같은 줄 같은 칸은 나중 것', async () => {
  const { db, A, B } = await two();
  await A.setPlanDay(ME, TODAY, [{ text: 'ZZ 1' }, { text: 'ZZ 2' }]);
  await B.refresh();
  const screen = screenOf(A);
  await B.latest('setPlanDay', planDayEdit(ME, TODAY, (a) => { a[1].memo = 'B 메모'; a[0].memo = 'B 가 먼저'; }));
  // A 는 B 변경을 모름(다시 읽지 않음) → ① 충돌 → 다시 읽고 최신 위에서 다시 계산
  await A.latest('setPlanDay', planDayEdit(ME, TODAY, (a) => { const j = planAt(a, planKey(screen, 0)); a[j].done = true; a[j].memo = 'A 가 나중'; }));
  assert.deepEqual((await dayOf(db)).map((x) => [!!x.done, x.memo]), [[true, 'A 가 나중'], [false, 'B 메모']]);
});

test('P3 · M6 저장 1 연결 오류 → 줄 서 있던 저장 2 는 안 씀 · 다시 읽은 뒤 한 번 더 누르면 됨', async () => {
  const { db, A } = await two();
  await A.setPlanDay(ME, TODAY, [{ text: 'ZZ 일' }]);
  db.setWriteDelay(30);
  db.failAt(1);
  const r = await Promise.allSettled([edit(A, (a, at) => { a[at(0)].memo = '메모'; }), edit(A, (a, at) => { a[at(0)].done = true; })]);
  assert.equal(r[0].status, 'rejected');
  assert.ok(r[1].status === 'rejected' && r[1].reason instanceof PmSkippedError, '저장 2 = 건너뜀');
  assert.deepEqual((await dayOf(db)).map((x) => [x.memo ?? '', !!x.done]), [['', false]], 'DB 그대로');
  await edit(A, (a, at) => { a[at(0)].done = true; });
  assert.equal((await dayOf(db))[0].done, true, '한 번 더 누르면 됨');
});

test('P3 · M6 저장 1 이 창 표로 막힘(남이 고침) → 줄 서 있던 최신 값 저장 2 도 안 씀', async () => {
  const { db, A, B } = await two();
  await A.setPlanDay(ME, TODAY, [{ text: 'ZZ 일' }]);
  const t = p2(A);
  const base = [pmBase('tasks', t.id, t)];
  await B.refresh();
  await B.updateTask(t.id, { ...t, actualPct: 60 }, 'u2', nameOf);
  await A.refresh();
  const r = await Promise.allSettled([A.withBase(base).updateTask(t.id, { ...t, name: 'ZZ' }, ME, nameOf), edit(A, (a, at) => { a[at(0)].done = true; })]);
  assert.ok(r[0].status === 'rejected' && r[0].reason instanceof PmStaleWindowError);
  assert.ok(r[1].status === 'rejected' && r[1].reason instanceof PmSkippedError);
  assert.equal((await dayOf(db))[0].done ?? false, false);
});

test('C5 메모리 모드도 같은 길 — 최신 값에서 만들고 바로 저장 · 할 것 없으면(null) 안 씀', async () => {
  const s = createPmStore(TODAY);
  await s.setPlanDay(ME, TODAY, [{ text: 'ZZ 일' }]);
  await Promise.all([edit(s, (a, at) => { a[at(0)].memo = '메모'; }), edit(s, (a, at) => { a[at(0)].done = true; })]);
  const d = (await s.snapshot()).planDays.find((p) => p.id === `${ME}|${TODAY}`)!.items;
  assert.deepEqual([d[0].memo, d[0].done], ['메모', true]);
  assert.equal(await s.latest('setPlanDay', planDayEdit(ME, TODAY, () => false)), null);
});
