import assert from 'node:assert/strict';
import test from 'node:test';
import { liveOf } from '@/domain/pm/rules';
import { makeSubTicket, makeTaskTicket, taskTicketIndex } from '@/domain/pm/ticket';
import { createPmStore } from './pm.store';

/** 2단계 저장소 — 티켓 번호·발행 잠금·세부 작업 연동·업무 수정 반영 (메모리, 사람은 가짜 ID u1·u3) */
const TODAY = '2026-11-25';
const nameOf = (id: string) => id;

async function setup() {
  const s = createPmStore(TODAY);
  const snap = await s.snapshot();
  const t = snap.tasks.find((x) => x.projectId === 'P2')!;
  const ctx = { today: TODAY, me: 'u1', approverOf: () => 'u3', nameOf, live: liveOf(t) };
  return { s, t, ctx };
}

test('발행: 번호 P2-0001부터, 같은 업무 두 번 발행 막힘, 취소하면 다시 발행', async () => {
  const { s, t, ctx } = await setup();
  const make = () => makeTaskTicket('P0-0000', { task: t, assigneeId: 'u1', prio: '보통', due: '2026-12-01' }, { reviewerId: '', approverId: '', memo: '' }, ctx);
  const [a] = await s.issueTickets([make()]);
  assert.equal(a.no, 'P2-0001');
  await assert.rejects(s.issueTickets([make()]), /이미 발행된 업무/);
  await s.moveTicket('P2-0001', '취소', '', 'u1', nameOf, TODAY);
  const [b] = await s.issueTickets([make()]);
  assert.equal(b.no, 'P2-0002');
  const snap = await s.snapshot();
  assert.equal(taskTicketIndex(snap.tickets).get(t.id)?.no, 'P2-0002');
});

test('세부 작업 티켓: 완료하면 세부 작업 완료, 진행 중이면 세부 작업 못 지움', async () => {
  const { s, t, ctx } = await setup();
  const sub = await s.addSubtask(t.id, 'API 연결', 'u1', '', 'u1', TODAY);
  const [x] = await s.issueTickets([makeSubTicket('P0-0000', t, sub, ctx)]);
  await assert.rejects(s.removeSubtask(sub.id), /진행 중이라 지울 수 없습니다/);
  for (const to of ['접수', '진행중', '검토요청'] as const) await s.moveTicket(x.no, to, '', 'u1', nameOf, TODAY);
  await s.moveTicket(x.no, '완료', '', 'u3', nameOf, TODAY);
  const snap = await s.snapshot();
  const after = snap.subtasks.find((v) => v.id === sub.id)!;
  assert.equal(after.done, true);
  assert.equal(after.doneDate, TODAY);
  await s.removeSubtask(sub.id); // 완료된 티켓이면 지울 수 있음
});

test('업무를 고치면 티켓도 따라가고 변경 이력에 "티켓 반영"', async () => {
  const { s, t, ctx } = await setup();
  await s.issueTickets([makeTaskTicket('P0-0000', { task: t, assigneeId: 'u1', prio: '보통', due: '2026-12-01' }, { reviewerId: '', approverId: '', memo: '' }, ctx)]);
  await s.updateTask(t.id, { ...t, name: `${t.name} (수정)` }, 'u1', nameOf, TODAY);
  const snap = await s.snapshot();
  assert.equal(snap.tickets[0].title, `${t.name} (수정)`);
  assert.match(snap.logs.at(-1)!.text, /티켓 P2-0001 반영/);
});
