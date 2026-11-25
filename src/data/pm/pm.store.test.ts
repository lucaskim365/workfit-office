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

test('사업별 화면 저장: 점검 보완 → 후속 기한 · 지적 사항, 협약 연장 승인 → 종료일 1번만 바뀜, 일정 고치기 이력', async () => {
  const s = createPmStore(TODAY);
  await s.setGovResult('P2', 'g_mid', { v: '보완', date: TODAY, memo: ' 공문 ', fix: '2026-12-10', items: [{ id: '', text: '실데이터 미입력', whoId: 'u1' }, { id: 'x', text: '  ', whoId: 'u1' }] }, 'u3');
  let snap = await s.snapshot();
  const r = snap.gov.find((x) => x.id === 'P2|g_mid')!;
  assert.deepEqual([r.v, r.fix, r.memo, r.items.length, r.items[0].st], ['보완', '2026-12-10', '공문', 1, '조치 전']);
  await assert.rejects(s.setFixItemState('P2', 'g_mid', r.items[0].id, '반려', ' ', 'u3', TODAY));
  await s.setFixItemState('P2', 'g_mid', r.items[0].id, '조치 완료', '했음', 'u1', TODAY);
  await s.setFixItemState('P2', 'g_mid', r.items[0].id, '반려', '아직', 'u3', TODAY);
  snap = await s.snapshot();
  const it = snap.gov.find((x) => x.id === 'P2|g_mid')!.items[0];
  assert.deepEqual([it.st, it.hist.map((h) => h.a).join(',')], ['조치 전', '조치 완료,반려']);
  // 판정을 계속으로 바꾸면 지적 사항 · 후속 기한은 지움
  await s.setGovResult('P2', 'g_mid', { v: '계속', date: TODAY, memo: '', fix: '2026-12-10', items: [] }, 'u3');
  snap = await s.snapshot();
  assert.deepEqual([snap.gov.find((x) => x.id === 'P2|g_mid')!.fix, snap.gov.find((x) => x.id === 'P2|g_mid')!.items.length], ['', 0]);

  const a = { id: 'A1', projectId: 'P2', date: TODAY, kind: 'ext', from: '2027-03-31', to: '2027-07-31', text: '', why: 'H/W', st: '승인' as const, by: '', applied: false };
  assert.equal(await s.saveAgreement(a, 'u3'), '2027-07-31');
  snap = await s.snapshot();
  assert.equal(snap.projects.find((p) => p.id === 'P2')!.end, '2027-07-31');
  assert.equal(await s.saveAgreement({ ...snap.agreements[0], text: '수정' }, 'u3'), '');

  const t = snap.tasks.find((x) => x.projectId === 'P2')!;
  assert.equal(await s.setTaskDates([{ id: t.id, start: '2026-12-01', end: '2026-12-20' }], '관리기준 필수 TASK', 'u3', TODAY), 1);
  snap = await s.snapshot();
  assert.match(snap.logs.at(-1)!.text, /^일정 .*→ 2026-12-01~2026-12-20 \(관리기준 필수 TASK\)$/);
  await s.setGovLink('P2', 'g_start', []);
  await s.setGovLink('P2', 'g_mid', [t.id]);
  await s.setGovLink('P2', 'g_start', null);
  snap = await s.snapshot();
  assert.deepEqual(snap.govLinks.map((x) => x.id), ['P2|g_mid']);
});

test('내 업무(3-5): 진행률 기록이 진행 중 티켓에도 · 나중에 할 일 · 변동 없음 · 마일스톤 승인', async () => {
  const { s, t, ctx } = await setup();
  await s.issueTickets([makeTaskTicket('P0-0000', { task: t, assigneeId: 'u1', prio: '보통', due: '2026-12-01' }, { reviewerId: '', approverId: '', memo: '' }, ctx)]);
  await s.setProgress(t.id, 40, '내 업무에서 기록', 'u1', TODAY);
  let snap = await s.snapshot();
  assert.equal(snap.tickets[0].prog, 40, '티켓 진행률도 40 (quickAp)');
  assert.equal(liveOf(snap.tasks.find((x) => x.id === t.id)!, snap.tickets[0]).pct, 40);
  await s.setLater('u1', t.id, true);
  await s.setLater('u1', t.id, true);
  snap = await s.snapshot();
  assert.deepEqual(snap.later, [{ id: 'u1', taskIds: [t.id] }]);
  await s.setLater('u1', t.id, false);
  await s.markNoChange([t.id, t.id], 'u1', TODAY);
  await s.approveMilestone(t.id, 'u3', 'u3 부장', TODAY);
  snap = await s.snapshot();
  assert.deepEqual(snap.later[0].taskIds, []);
  assert.deepEqual(snap.weekChecks.map((x) => x.id), [`2026-11-23|${t.id}`]);
  assert.equal(snap.msOk[0].id, t.id);
  assert.match(snap.logs.at(-1)!.text, /마일스톤 승인 — u3 부장/);
});

test('업무계획(3-6): 그날 저장 · 반복 업무가 고친 앞날에도 · 남에게 배정한 세부 작업이 그 사람 저장된 날에 · 번호 바뀌면 따라감 · 임시저장 30일', async () => {
  const { s, t } = await setup();
  await s.setPlanDay('u1', '2026-11-26', [{ taskId: t.id, auto: true }, { text: '현장 미팅', hours: 2 }]);
  await s.setPlanDay('u1', '2026-11-24', [{ text: '지난 날' }]);
  let snap = await s.snapshot();
  assert.deepEqual(snap.planDays.find((p) => p.date === '2026-11-26')!.items, [{ taskId: t.id }, { text: '현장 미팅', hours: 2 }], '자동 표시는 떼고 저장');
  await s.addPlanRep('u1', [4], '주간보고', TODAY); // 목요일 = 11/26
  snap = await s.snapshot();
  assert.equal(snap.planDays.find((p) => p.date === '2026-11-26')!.items[0].text, '주간보고');
  assert.equal(snap.planDays.find((p) => p.date === '2026-11-24')!.items.length, 1, '지난 날은 그대로');
  // u3 가 12/1 계획을 고쳐 둠 → u1 이 u3 에게 12/1 세부 작업 배정
  await s.setPlanDay('u3', '2026-12-01', [{ text: '회의' }]);
  const sub = await s.addSubtask(t.id, '화면 API', 'u3', '2026-12-01', 'u1', TODAY, 3);
  snap = await s.snapshot();
  assert.deepEqual(snap.planDays.find((p) => p.who === 'u3')!.items[1], { taskId: t.id, subId: sub.id, hours: 3 });
  await s.updateTask(t.id, { ...t, id: `${t.projectId}|99-99`, code: '99-99' }, 'u1');
  snap = await s.snapshot();
  assert.ok(snap.planDays.every((p) => p.items.every((it) => it.taskId !== t.id)), '옛 번호 없음');
  await s.savePdfDraft({ who: 'u1', date: '2026-10-01', dept: '개발', name: 'u1', rows: [], at: '' }, TODAY);
  await s.savePdfDraft({ who: 'u1', date: TODAY, dept: '개발', name: 'u1', rows: [['a', '', '50%']], at: '11/25 10:00' }, TODAY);
  snap = await s.snapshot();
  assert.deepEqual(snap.pdfDrafts.map((x) => x.date), [TODAY], '30일 지난 임시저장은 지움');
  await s.ensureCarryFrom('2026-11-26');
  await s.ensureCarryFrom('2026-12-01');
  assert.equal((await s.snapshot()).settings.carryFrom, '2026-11-26', '처음 한 번만');
});

test('3-7 저장: 즐겨찾기 켜고 끄기 · 알림 확인 · 지표 지우면 실측 기록도 지움', async () => {
  const s = createPmStore('2026-11-25');
  assert.equal(await s.toggleFav('me', { v: 'dash/site', k: 'P2' }), true);
  await s.toggleFav('me', { v: 'task/wbs', k: '' });
  assert.equal(await s.toggleFav('me', { v: 'dash/site', k: 'P2' }), false);
  assert.deepEqual((await s.snapshot()).favs, [{ id: 'me', items: [{ v: 'task/wbs', k: '' }] }]);
  await s.setSeen('me', '새 티켓 · P2-0001', true);
  await s.setSeen('me', '다른 알림', true);
  await s.setSeen('me', '다른 알림', false);
  assert.deepEqual((await s.snapshot()).seen, [{ id: 'me', items: { '새 티켓 · P2-0001': '2026-11-25' } }]);
  const kid = await s.saveKpiDef({ projectId: 'P4', f: 'Q', name: '불량률', unit: '%', dir: 'down', base: 2, target: 1, w: 1, period: '', method: '' });
  await s.saveKpiMeas({ projectId: 'P4', kid, date: '2026-11-25', val: 1.5, memo: '' }, 'me');
  await s.saveKpiMeas({ projectId: 'P2', kid: 'P0', date: '2026-11-25', val: 25, memo: '' }, 'me');
  const m = (await s.snapshot()).kpiMeas.find((x) => x.kid === 'P0')!;
  await s.saveKpiMeas({ ...m, val: 24 }, 'other');
  assert.deepEqual((await s.snapshot()).kpiMeas.filter((x) => x.kid === 'P0').map((x) => [x.val, x.who]), [[24, 'me']], '고쳐도 기록한 사람은 그대로');
  await s.removeKpiDef(kid);
  const snap = await s.snapshot();
  assert.deepEqual([snap.kpiDefs.length, snap.kpiMeas.map((x) => x.kid)], [0, ['P0']]);
});

test('4단계 산출물 저장: 상태 고르기 · 파일 올리면 제출완료 · 상태를 바꿔도 파일 이름은 그대로 · 업무 번호 바뀌면 따라감', async () => {
  const s = createPmStore('2026-11-25');
  const t = (await s.snapshot()).tasks.find((x) => x.projectId === 'P2')!;
  await s.setDoc(t.id, '작성중', 'me');
  assert.deepEqual((await s.snapshot()).docs, [{ id: t.id, projectId: 'P2', st: '작성중', file: '', date: '2026-11-25', by: 'me' }]);
  await s.uploadDoc(t.id, '설계서.pdf', 'u2');
  await s.setDoc(t.id, '미작성', 'me');
  assert.deepEqual((await s.snapshot()).docs.map((d) => [d.st, d.file, d.by]), [['미작성', '설계서.pdf', 'me']]);
  await s.updateTask(t.id, { ...t, id: `P2|99-99`, code: '99-99' }, 'me');
  assert.deepEqual((await s.snapshot()).docs.map((d) => d.id), ['P2|99-99']);
  await assert.rejects(s.setDoc('없음', '작성중', 'me'));
});

test('4단계 CR 저장: 접수 → 검토중 · 번호 · 수정 · 검토(의견 필수, 한 번만) · 업무 잇기 · 업무 번호 따라감', async () => {
  const s = createPmStore('2026-11-25');
  const base = { projectId: 'P2', cat: '기능 추가', title: '바코드 라벨 추가', desc: '', req: '도입기업 담당자', date: '2026-11-24', prio: '보통', days: 5, cost: 100 };
  const a = await s.addCr(base, 'u1');
  const b = await s.addCr({ ...base, title: '두 번째' }, 'u1');
  assert.deepEqual([a.id, a.status, a.by, a.at, b.id], ['CR-001', '검토중', 'u1', '2026-11-25', 'CR-002']);
  assert.deepEqual((await s.snapshot()).crs.map((c) => c.id), ['CR-002', 'CR-001'], '최근 접수가 앞');
  await s.updateCr('CR-001', { ...base, days: 9 });
  await assert.rejects(s.reviewCr('CR-001', '승인', '  ', 'pm'), /의견/);
  await s.reviewCr('CR-001', '승인', '일정 여유 있음', 'pm');
  await assert.rejects(s.reviewCr('CR-001', '반려', '다시', 'pm'), /이미 승인/);
  const t = (await s.snapshot()).tasks.find((x) => x.projectId === 'P2')!;
  await s.linkCrTask('CR-001', t.id);
  await s.updateTask(t.id, { ...t, id: 'P2|99-01', code: '99-01' }, 'pm');
  const c = (await s.snapshot()).crs.find((x) => x.id === 'CR-001')!;
  assert.deepEqual([c.status, c.comment, c.reviewer, c.revD, c.days, c.taskId], ['승인', '일정 여유 있음', 'pm', '2026-11-25', 9, 'P2|99-01']);
  await s.removeCr('CR-002');
  assert.deepEqual((await s.snapshot()).crs.map((x) => x.id), ['CR-001']);
});

test('5단계 이슈 저장: 등록(긴급이면 보고됨) · 수정 · 윗선 보고(긴급 · 대응중) · 연관 업무 번호 따라감 · 삭제', async () => {
  const s = createPmStore('2026-11-25');
  const t = (await s.snapshot()).tasks.find((x) => x.projectId === 'P2')!;
  const base = { projectId: 'P2', title: 'PLC 통신 끊김', cat: '설비 통신 장애', sev: '보통' as const, status: '열림', ownerId: 'u2', watchIds: ['u3'], date: '2026-11-24', equip: '', taskId: t.id, desc: '', action: '' };
  const a = await s.addIssue(base, 'u1');
  const b = await s.addIssue({ ...base, title: '긴급 건', sev: '긴급' }, 'u1');
  assert.deepEqual([a.id, a.esc, a.by, a.at, b.id, b.esc], ['I-001', false, 'u1', '2026-11-25', 'I-002', true]);
  await s.escalateIssue('I-001');
  await s.updateIssue('I-002', { ...base, title: '긴급 건', sev: '긴급', status: '해결', action: '재부팅' });
  await s.updateTask(t.id, { ...t, id: 'P2|99-02', code: '99-02' }, 'u1');
  let L = (await s.snapshot()).issues;
  assert.deepEqual(L.map((i) => [i.id, i.sev, i.status, i.esc, i.by, i.taskId]), [['I-002', '긴급', '해결', true, 'u1', 'P2|99-02'], ['I-001', '긴급', '대응중', true, 'u1', 'P2|99-02']]);
  await s.removeIssue('I-002');
  L = (await s.snapshot()).issues;
  assert.deepEqual(L.map((i) => i.id), ['I-001']);
});
