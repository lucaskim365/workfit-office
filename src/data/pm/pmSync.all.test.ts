import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { liveOf } from '@/domain/pm/rules';
import { pmProjectSchema, type PmTask } from '@/domain/pm/schema';
import { makeTaskTicket } from '@/domain/pm/ticket';
import { pickToLine, qIt, quoteDraft } from '@/domain/pm/quote';
import { fillMyungsung } from '@/domain/pm/quoteDemo';
import { createPmStore, PM_READ_METHODS, type PmStore } from './pm.store';
import { reread, seededDb, snapDiff } from './pmTestStores';

/**
 * 테스트 ⓐ (설계 5.7.4, K8) — 저장 함수를 **모두** 한 번 이상 부르고, 부를 때마다
 * 같은 가짜 DB 에서 새로 읽은 저장소의 스냅숏이 메모리판 스냅숏과 칸마다 같은지 본다 (빠뜨린 칸 · JSON 변환 · 배열 순서).
 * 새 저장 함수를 더하고 여기 빠뜨리면 마지막 검사에서 실패.
 */
const TODAY = '2026-11-25';
mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12) });
const nameOf = (id: string) => id;
const idGen = () => { let n = 0; return (p: string) => `${p}x${(++n).toString(36).padStart(4, '0')}`; };

type Ctx = Record<string, any>;
type Step = [label: string, run: (s: PmStore, c: Ctx) => Promise<unknown>];

const snap = (s: PmStore) => s.snapshot();
const p2 = async (s: PmStore, i = 0) => (await snap(s)).tasks.filter((t) => t.projectId === 'P2')[i];

const STEPS: Step[] = [
  ['addTask', async (s, c) => { const t = await p2(s); c.added = await s.addTask({ ...t, id: 'P2|01-99', code: '01-99', name: '끼운 업무', order: 0 }, 'u1'); }],
  ['updateTask', async (s) => { const t = await p2(s); await s.updateTask(t.id, { ...t, name: `${t.name} (수정)` }, 'u1', nameOf); }],
  ['bulkUpdate', async (s) => { const t = await p2(s, 1); await s.bulkUpdate([{ next: { ...t, md: 3 }, summary: '공수 3' }], 'u1'); }],
  ['setProgress', async (s) => { await s.setProgress((await p2(s)).id, 40, '기록', 'u1'); }],
  ['setLater', async (s) => { await s.setLater('u1', (await p2(s)).id, true); }],
  ['markNoChange', async (s) => { await s.markNoChange([(await p2(s)).id], 'u1'); }],
  ['approveMilestone', async (s) => { await s.approveMilestone((await p2(s)).id, 'u3', 'u3 부장'); }],
  ['addSubtask', async (s, c) => { c.sub = await s.addSubtask((await p2(s)).id, 'API 연결', 'u3', '2026-12-01', 'u1', TODAY, 2); }],
  ['updateSubtask', async (s, c) => { await s.updateSubtask(c.sub.id, { done: true }, 'u1'); }],
  ['issueTickets', async (s) => {
    const t = await p2(s);
    const ctx = { today: TODAY, me: 'u1', approverOf: () => 'u3', nameOf, live: liveOf(t) };
    await s.issueTickets([makeTaskTicket('P0-0000', { task: t, assigneeId: 'u1', prio: '보통', due: '2026-12-01' }, { reviewerId: '', approverId: '', memo: '' }, ctx)]);
  }],
  ['moveTicket', async (s) => { await s.moveTicket('P2-0001', '접수', '', 'u1', nameOf); }],
  ['putTicket', async (s) => { const x = (await snap(s)).tickets[0]; await s.putTicket({ ...x, due: '2026-12-05' }); }],
  ['commentTicket', async (s) => { await s.commentTicket('P2-0001', '확인 부탁', 'u1'); }],
  ['addTicketFile', async (s) => { await s.addTicketFile('P2-0001', '설계서.pdf', 'u1'); }],
  ['removeTicketFile', async (s) => { await s.removeTicketFile('P2-0001', 0, 'u1'); }],
  ['checkDeadlines', async (s) => { await s.checkDeadlines([{ projectId: 'P2', kind: 'gov', id: 'g_start' }, { projectId: 'P2', kind: 'plan', id: 'd1' }], TODAY, 'u1', false); }],
  ['uncheckDeadline', async (s) => { await s.uncheckDeadline('P2', 'plan', 'd1'); }],
  ['setGovResult', async (s) => { await s.setGovResult('P2', 'g_mid', { v: '보완', date: TODAY, memo: '공문', fix: '2026-12-10', items: [{ id: '', text: '실데이터 미입력', whoId: 'u1' }] }, 'u3'); }],
  ['setFixItemState', async (s) => { const r = (await snap(s)).gov.find((x) => x.id === 'P2|g_mid')!; await s.setFixItemState('P2', 'g_mid', r.items[0].id, '조치 완료', '했음', 'u1'); }],
  // 앞 기록(g_start) 뒤에 있던 것을 다시 쓰면 맨 뒤로 (filter + push) — DB 순서도 같은지
  ['checkDeadlines 다시', async (s) => { await s.checkDeadlines([{ projectId: 'P2', kind: 'gov', id: 'g_start' }], TODAY, 'u3', true); }],
  ['removeGovResult', async (s) => { await s.removeGovResult('P2', 'g_start'); }],
  ['saveAgreement', async (s) => { await s.saveAgreement({ id: 'A1', projectId: 'P2', date: TODAY, kind: 'ext', from: '2027-03-31', to: '2027-07-31', text: '', why: 'H/W', st: '승인', by: '', applied: false }, 'u3'); }],
  ['saveAgreement 둘째', async (s) => { await s.saveAgreement({ id: 'A2', projectId: 'P2', date: TODAY, kind: 'staff', from: '', to: '', text: '인력', why: '', st: '준비 중', by: '', applied: false }, 'u3'); }],
  ['removeAgreement', async (s) => { await s.removeAgreement('A2'); }],
  ['setGovLink', async (s) => { await s.setGovLink('P2', 'g_mid', [(await p2(s)).id]); }],
  ['setTaskDates', async (s) => { await s.setTaskDates([{ id: (await p2(s, 1)).id, start: '2026-12-01', end: '2026-12-20' }], '관리기준', 'u3'); }],
  ['setBidResult', async (s) => { await s.setBidResult('P2', '선정', 'u1'); }],
  ['setPlanDay', async (s) => { await s.setPlanDay('u1', '2026-11-26', [{ taskId: (await p2(s)).id }, { text: '현장 미팅', hours: 2 }]); }],
  ['ensureCarryFrom', async (s) => { await s.ensureCarryFrom('2026-11-26'); }],
  ['addPlanRep', async (s) => { await s.addPlanRep('u1', [4], '주간보고'); }],
  ['removePlanRep', async (s) => { await s.removePlanRep('u1', 0); }],
  ['savePdfDraft', async (s) => { await s.savePdfDraft({ who: 'u1', date: TODAY, dept: '개발', name: 'u1', rows: [['a', '', '50%']], at: '11/25 10:00' }); }],
  ['removePdfDraft', async (s) => { await s.removePdfDraft('u1', TODAY); }],
  ['saveKpiDef', async (s, c) => { c.kid = await s.saveKpiDef({ projectId: 'P4', f: 'Q', name: '불량률', unit: '%', dir: 'down', base: 2, target: 1, w: 1, period: '', method: '' }); }],
  ['saveKpiMeas', async (s, c) => { await s.saveKpiMeas({ projectId: 'P4', kid: c.kid, date: TODAY, val: 1.5, memo: '' }, 'me'); }],
  ['removeKpiMeas', async (s) => { await s.removeKpiMeas((await snap(s)).kpiMeas[0].id); }],
  ['removeKpiDef', async (s, c) => { await s.removeKpiDef(c.kid); }],
  ['addAiMeas', async (s) => { await s.addAiMeas({ projectId: 'P4', i: 0, date: TODAY, val: 1, ok: '충족', memo: '' }, 'me'); }],
  ['setSeen', async (s) => { await s.setSeen('me', '새 티켓 · P2-0001', true); }],
  ['toggleFav', async (s) => { await s.toggleFav('me', { v: 'dash/site', k: 'P2' }); }],
  ['setDoc', async (s) => { await s.setDoc((await p2(s)).id, '작성중', 'me'); }],
  ['uploadDoc', async (s) => { await s.uploadDoc((await p2(s, 1)).id, '설계서.pdf', 'me'); }],
  ['addIssue', async (s) => { await s.addIssue({ projectId: 'P2', title: 'PLC 끊김', cat: '설비 통신 장애', sev: '보통', status: '열림', ownerId: 'u2', watchIds: [], date: TODAY, equip: '', taskId: (await p2(s)).id, desc: '', action: '' }, 'u1'); }],
  ['addIssue 둘째', async (s) => { await s.addIssue({ projectId: 'P3', title: '둘째', cat: '기타', sev: '긴급', status: '열림', ownerId: 'u2', watchIds: [], date: TODAY, equip: '', taskId: '', desc: '', action: '' }, 'u1'); }],
  ['updateIssue', async (s) => { const i = (await snap(s)).issues.find((x) => x.id === 'I-001')!; await s.updateIssue('I-001', { ...i, status: '대응중' }); }],
  ['escalateIssue', async (s) => { await s.escalateIssue('I-001'); }],
  ['removeIssue', async (s) => { await s.removeIssue('I-002'); }],
  ['addMeeting', async (s, c) => { c.mt = await s.addMeeting({ projectId: 'P2', type: '주간 회의', title: '주간 회의', date: TODAY, place: '', attIds: ['u1'], ext: '', content: '진척 공유', decision: '' }, 'u1'); }],
  ['addAction', async (s, c) => { c.act = await s.addAction({ text: 'I/O 리스트', whoId: 'u2', due: '2026-12-01', projectId: 'P2', meetingId: c.mt }, 'u1'); }],
  ['updateMeeting', async (s, c) => { await s.updateMeeting(c.mt, { projectId: 'P3', type: '주간 회의', title: '주간 회의', date: TODAY, place: '', attIds: ['u1'], ext: '', content: '진척 공유', decision: '범위 확정' }); }],
  ['setActionDone', async (s, c) => { await s.setActionDone(c.act.id, true, 'u2'); }],
  ['updateAction', async (s, c) => { await s.updateAction(c.act.id, { text: 'I/O 리스트 (고침)', whoId: 'u2', due: '2026-12-02', projectId: 'P3', meetingId: c.mt, done: false }, 'u2'); }],
  ['removeMeeting', async (s, c) => { await s.removeMeeting(c.mt); }],
  ['addAction 둘째', async (s, c) => { c.act2 = await s.addAction({ text: '지울 것', whoId: 'u2', due: '', projectId: 'P2', meetingId: '' }, 'u1'); }],
  ['removeAction', async (s, c) => { await s.removeAction(c.act2.id); }],
  ['addProject', async (s) => { await s.addProject(pmProjectSchema.parse({ id: 'P14', company: '㈜새회사', biz: '부처협업형(산업보안)', supplier: '워크핏 주식회사', start: '2027-01-04', end: '2027-09-30', pmName: '박명규 부장' }), 'std', false, 'pm'); }],
  ['updateProject', async (s) => { const p = (await snap(s)).projects.find((x) => x.id === 'P14')!; await s.updateProject({ ...p, company: '㈜새회사2', summary: '착수 준비' }, 'pm'); }],
  ['completeTasks', async (s) => { const t = (await snap(s)).tasks.find((x) => x.projectId === 'P14')!; await s.completeTasks([t.id], '이미 한 일', 'pm'); }],
  ['setTlinks', async (s, c) => { const x = await snap(s); c.std = x.stdTasks.find((t) => t.biz === '부처협업형(산업보안)' && t.code === '7.7')!; await s.setTlinks([[(await p2(s)).id, c.std.id]]); }],
  ['addStdToProject', async (s, c) => { await s.addStdToProject('P3', [{ stdId: c.std.id }, { stdId: c.std.id }], '표준 세부 TASK 추가', 'pm'); }],
  ['stdFromTask', async (s) => { await s.stdFromTask((await p2(s)).id); }],
  ['moveStd', async (s, c) => { await s.moveStd(c.std.id, -1); }],
  ['saveStd', async (s, c) => { const t = (await snap(s)).stdTasks.find((x) => x.id === c.std.id)!; await s.saveStd({ ...t, name: `${t.name} (고침)` }); }],
  ['removeStd', async (s, c) => { await s.removeStd(c.std.id); }],
  ['saveCode 단계 이름', async (s) => { const st = (await snap(s)).codes.find((x) => x.group === 'stage' && x.biz === '부처협업형(산업보안)' && x.name === '01 자재관리')!; await s.saveCode({ ...st, name: '01 자재' }, 'pm'); }],
  ['saveCode 새 상태', async (s) => { const st = (await snap(s)).codes.find((x) => x.group === 'status')!; await s.saveCode({ ...st, id: 'cNEW', name: '보류' }, 'pm'); }],
  ['removeCode', async (s) => { await s.removeCode('cNEW'); }],
  ['moveStage', async (s) => { const st = (await snap(s)).codes.find((x) => x.group === 'stage' && x.biz === '부처협업형(산업보안)')!; await s.moveStage(st.id, 1); }],
  ['saveOrg', async (s) => { const o = (await snap(s)).orgs.find((x) => x.name === '경남TP')!; await s.saveOrg({ ...o, name: '경남테크노파크' }); }],
  ['saveOrg 새로', async (s) => { const o = (await snap(s)).orgs[0]; await s.saveOrg({ ...o, id: '', name: '새 기관' }); }],
  ['removeOrg', async (s) => { await s.removeOrg((await snap(s)).orgs.find((x) => x.name === '새 기관')!.id); }],
  ['saveMoneyCfg', async (s) => { await s.saveMoneyCfg({ ...(await snap(s)).moneyCfg, cloudMonthly: 350000 }); }],
  ['saveFundRule', async (s, c) => { c.rule = await s.saveFundRule({ ...(await snap(s)).fundRules[0], id: '', biz: '테스트 기준' }); }],
  ['removeFundRule', async (s, c) => { await s.removeFundRule(c.rule.id); }],
  ['saveItem', async (s, c) => { c.item = await s.saveItem({ ...(await snap(s)).items[0], id: '', name: '테스트 품목', hist: [] }); }],
  ['removeItem', async (s, c) => { await s.removeItem(c.item.id); }],
  ['saveQuote', async (s, c) => {
    const x = await snap(s);
    const kio = x.items.find((i) => i.name === '키오스크 Panel PC')!;
    let E = fillMyungsung(quoteDraft(null, 'P4', undefined, x.moneyCfg, TODAY), 'F2');
    E = { ...E, name: '검수 견적', q: { ...E.q, items: [...E.q.items, pickToLine(kio, 'hw', 2)] } };
    c.q = (await s.saveQuote(E, '한일', TODAY)).c;
  }],
  ['registerItems', async (s) => { await s.registerItems([qIt('hw', { name: '검수용 태블릿', price: 900000, cost: 600000 })], '한일', '2026-11-06'); }],
  ['saveFund', async (s) => { const f = (await snap(s)).funds.find((x) => x.id === 'P4')!; await s.saveFund({ ...f, man: 1000 }); }],
  ['savePay', async (s, c) => { c.pay = await s.savePay({ id: '', projectId: 'P4', cid: c.q.id, name: '추가', rate: 0, amt: 1000, due: '', inv: '', paid: '' }); }],
  ['removePay', async (s, c) => { await s.removePay(c.pay.id); }],
  ['saveCost', async (s, c) => { c.cost = await s.saveCost({ id: '', projectId: 'P4', date: TODAY, cat: '기타', amt: 1000, vendor: '', desc: '' }); }],
  ['removeCost', async (s, c) => { await s.removeCost(c.cost.id); }],
  ['saveOh', async (s) => { await s.saveOh('2026-03', 10000000, 'x', 5000000, 'u1', TODAY); }],
  ['removeContract', async (s, c) => { await s.removeContract(c.q.id); }],
  ['setReport', async (s) => { await s.setReport('P2', '2026-11-23', { note: '시연 완료' }, 'pm'); }],
  ['sendUpdRequest', async (s) => { await s.sendUpdRequest('u1', 'P2', 'pm'); }],
  ['addCr', async (s) => { await s.addCr({ projectId: 'P2', cat: '기능 추가', title: '바코드', desc: '', req: '담당자', date: '2026-11-24', prio: '보통', days: 5, cost: 100 }, 'u1'); }],
  ['addCr 둘째', async (s) => { await s.addCr({ projectId: 'P2', cat: '기능 추가', title: '둘째', desc: '', req: '', date: '2026-11-24', prio: '보통', days: 1, cost: 0 }, 'u1'); }],
  ['updateCr', async (s) => { await s.updateCr('CR-001', { projectId: 'P2', cat: '기능 추가', title: '바코드 (고침)', desc: '', req: '담당자', date: '2026-11-24', prio: '높음', days: 9, cost: 100 }); }],
  ['reviewCr', async (s) => { await s.reviewCr('CR-001', '승인', '여유 있음', 'pm'); }],
  ['linkCrTask', async (s) => { await s.linkCrTask('CR-001', (await p2(s)).id); }],
  ['removeCr', async (s) => { await s.removeCr('CR-002'); }],
  ['setLoadMax', async (s) => { await s.setLoadMax(6); }],
  ['resetBaseline', async (s) => { await s.resetBaseline('P2', '재설정', 'pm'); }],
  // 번호 바꾸기 (rekey) — 세부 작업 · 표시 · 기준선 · 업무계획 · 이슈 · CR 이 따라감
  ['updateTask 번호 바꾸기', async (s) => { const t = await p2(s); await s.updateTask(t.id, { ...t, id: 'P2|99-99', code: '99-99' }, 'u1', nameOf); }],
  ['removeSubtask', async (s, c) => { await s.removeSubtask(c.sub.id); }],
  ['removeProject', async (s) => { await s.removeProject('P14', 'pm'); }],
];

test('ⓐ 저장 함수 전부: 부를 때마다 DB 에서 새로 읽은 스냅숏 = 메모리판 스냅숏 (칸 · 순서)', async () => {
  const g1 = idGen();
  const mem = createPmStore(TODAY, { nid: g1 });
  const g2 = idGen();
  const db = seededDb(TODAY, { nid: g2 });
  const dbs = createPmStore(TODAY, { db, nid: g2 });
  assert.equal(snapDiff(await reread(db, TODAY), await mem.snapshot()), null, '처음 넣은 값');
  const called = new Set<string>();
  const spy = (s: PmStore) => new Proxy(s, { get: (o, k) => { if (typeof k === 'string') called.add(k); return (o as any)[k]; } });
  const cm: Ctx = {}; const cd: Ctx = {};
  for (const [label, run] of STEPS) {
    await run(spy(mem), cm);
    await run(spy(dbs), cd);
    const d = snapDiff(await reread(db, TODAY), await mem.snapshot());
    assert.equal(d, null, `${label} 뒤 다름`);
    assert.equal(snapDiff(dbs.peek().snap, await mem.snapshot()), null, `${label} 뒤 DB 저장소 상태`);
  }
  const saves = Object.keys(mem).filter((k) => !(PM_READ_METHODS as readonly string[]).includes(k));
  const missed = saves.filter((k) => !called.has(k));
  assert.deepEqual(missed, [], '한 번도 안 부른 저장 함수');
  assert.equal(saves.length, 90, '저장 함수 90개 (설계 5.7 근거 줄)');
});

test('업무 순서: 사이에 끼운 업무는 앞뒤 업무 사이 순서 값 · 사업을 지운 뒤 새로 만든 업무는 맨 뒤 (DB 는 order 로 다시 정렬)', async () => {
  const s = createPmStore(TODAY);
  const t = (await s.snapshot()).tasks.filter((x) => x.projectId === 'P2')[0];
  const a: PmTask = await s.addTask({ ...t, id: 'P2|01-98', code: '01-98', order: 0 }, 'u1');
  const L = (await s.snapshot()).tasks;
  const i = L.findIndex((x) => x.id === a.id);
  assert.ok(L[i - 1].order < a.order && a.order < L[i + 1].order);
  await s.removeProject('P2', 'u1');
  const n = await s.addProject(pmProjectSchema.parse({ id: 'P20', company: 'x', biz: '부처협업형(산업보안)', start: '2027-01-04', end: '2027-09-30' }), 'std', false, 'pm');
  const L2 = (await s.snapshot()).tasks;
  assert.ok(L2.slice(-n).every((x) => x.projectId === 'P20'));
  assert.deepEqual(L2.map((x) => x.order), [...L2.map((x) => x.order)].sort((p, q) => p - q), '배열 순서 = order 순서');
});
