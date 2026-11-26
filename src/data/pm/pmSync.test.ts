import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { liveOf } from '@/domain/pm/rules';
import { pmProjectSchema, type PmTask } from '@/domain/pm/schema';
import { makeTaskTicket, taskTicketIndex } from '@/domain/pm/ticket';
import { fillMyungsung } from '@/domain/pm/quoteDemo';
import { pickToLine, quoteDraft } from '@/domain/pm/quote';
import { createPmStore, latestSnapshot, type PmStore } from './pm.store';
import { createFakePmDb, type FakePmDb } from './pmDb.fake';
import { docKeyOf, PM_COLLS, recsOf, snapshotRows } from './pmDb';
import { reread, seededDb, snapDiff } from './pmTestStores';

/** 7-2 저장 계층 테스트 ⓑ~ⓖ · N1~N3 · 스위치 가드 · 처음 열 때 점검 (설계 5.7.2~5.7.4) — 가짜 DB 만, 개발 DB 안 씀 */
const TODAY = '2026-11-25';
mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12) });
const nameOf = (id: string) => id;

const open = async (db: FakePmDb, nid?: (p: string) => string) => { const s = createPmStore(TODAY, { db, nid }); await s.refresh(); return s; };
const idGen = () => { let n = 0; return (p: string) => `${p}x${(++n).toString(36).padStart(4, '0')}`; };
const taskOf = async (s: PmStore, k = 'P2', i = 0) => (await s.snapshot()).tasks.filter((t) => t.projectId === k)[i];
const ticketFor = (t: PmTask) => makeTaskTicket('P0-0000', { task: t, assigneeId: 'u1', prio: '보통', due: '2026-12-01' }, { reviewerId: '', approverId: '', memo: '' },
  { today: TODAY, me: 'u1', approverOf: () => 'u3', nameOf, live: liveOf(t) });
/** 같은 DB 를 다시 읽은 것 = 저장소가 들고 있는 것 (실패 뒤 화면이 DB 기준인지) */
const sameAsDb = async (s: PmStore, db: FakePmDb) => assert.equal(snapDiff(await reread(db, TODAY), s.peek().snap), null);

test('처음 값: 메모리판 1,441건 = 5.7.8 표, 다시 읽으면 메모리판과 같고 점검 안내 없음', async () => {
  const db = seededDb(TODAY);
  const n = Object.fromEntries([...db.data].map(([k, m]) => [k, m.size]));
  assert.deepEqual([n.pmProjects, n.pmTasks, n.pmTaskFunctions, n.pmSubtasks, n.pmBaselines, n.pmMaster, n.pmMarks, n.pmMoney, n.pmMoneyItems, n.pmMoneyContracts], [12, 338, 267, 432, 6, 272, 2, 20, 89, 3]);
  assert.equal(Object.values(n).reduce((a, b) => a + b, 0), 1441);
  const s = await open(db);
  assert.equal(snapDiff(s.peek().snap, await createPmStore(TODAY).snapshot()), null);
  assert.deepEqual(s.notices(), []);
  // 처음 읽기 요청 수 ≈ 34 (5.7.5)
  assert.equal(db.stats.reads, 34, '처음 읽기 34번');
});

test('바뀐 것이 없으면 쓰지 않음 · 업무 1건 고치면 업무 1 · 이력 1 만 (+ 비교 읽기 1)', async () => {
  const db = seededDb(TODAY);
  const s = await open(db);
  const w0 = db.stats.writes;
  await s.setLoadMax(8);
  assert.equal(db.stats.writes, w0, '같은 값');
  const r0 = db.stats.reads;
  const t = await taskOf(s);
  await s.updateTask(t.id, { ...t, name: '이름만' }, 'u1', nameOf);
  assert.equal(db.stats.writes - w0, 2);
  assert.equal(db.stats.reads - r0, 1, '고칠 문서 내용 비교 1번');
});

test('ⓑ 중간 실패 — 사업 삭제: 끊기면 사업 문서는 남고(맨 나중에 지움) 화면은 DB 기준, [삭제]를 다시 누르면 마저 지움', async () => {
  const db = seededDb(TODAY);
  const s = await open(db);
  db.failAt(150); // 지우기는 딸린 것부터 (계약 · 대금 · 기준선 · 세부 작업 82 · 세부 기능 58 → 업무 도중)
  await assert.rejects(s.removeProject('P2', 'u1'), /일부만 저장됐습니다/);
  await sameAsDb(s, db);
  const mid = s.peek().snap;
  assert.ok(mid.projects.some((p) => p.id === 'P2'), '사업은 남음');
  const left = mid.tasks.filter((t) => t.projectId === 'P2').length;
  assert.ok(left > 0 && left < 72, `업무 일부만 지워짐 (${left})`);
  await s.removeProject('P2', 'u1');
  const x = await reread(db, TODAY);
  const gone = (id: string) => id.startsWith('P2|');
  assert.deepEqual([x.projects.some((p) => p.id === 'P2'), x.tasks.some((t) => t.projectId === 'P2'), x.subtasks.some((v) => gone(v.taskId)), x.functions.some((f) => gone(f.id))], [false, false, false, false]);
  await sameAsDb(s, db);
});

test('ⓑ 중간 실패 — 업무 번호 바꾸기: 끊기면 같은 업무가 2건 + 안내, 옛 번호 업무를 같은 새 번호로 다시 저장하면 마저 옮기고 옛 업무 지움', async () => {
  const db = seededDb(TODAY);
  const s = await open(db);
  const t = await taskOf(s);
  const subs = s.peek().snap.subtasks.filter((v) => v.taskId === t.id).length;
  assert.ok(subs > 0);
  const nx = { ...t, id: 'P2|99-99', code: '99-99' };
  db.failAt(2); // ① 새 번호 업무는 쓰고, 딸린 것 옮기다 끊김
  await assert.rejects(s.updateTask(t.id, nx, 'u1', nameOf), /일부만 저장됐습니다/);
  await sameAsDb(s, db);
  let x = s.peek().snap;
  assert.deepEqual([x.tasks.some((v) => v.id === t.id), x.tasks.some((v) => v.id === nx.id)], [true, true], '잃는 것 없이 2건');
  assert.match(s.notices().join('\n'), /P2 99-99 의 번호 바꾸기가 끊겼습니다.*옛 번호 P2 01-01/);
  // 옛 번호 업무를 열어 같은 새 번호로 다시 저장
  const old = x.tasks.find((v) => v.id === t.id)!;
  await s.updateTask(old.id, { ...old, id: nx.id, code: nx.code }, 'u1', nameOf);
  x = await reread(db, TODAY);
  assert.deepEqual([x.tasks.some((v) => v.id === t.id), x.tasks.filter((v) => v.id === nx.id).length, x.subtasks.filter((v) => v.taskId === nx.id).length, x.subtasks.some((v) => v.taskId === t.id)], [false, 1, subs, false]);
  assert.ok(x.functions.some((f) => f.id === nx.id) && !x.functions.some((f) => f.id === t.id));
  const s2 = await open(db);
  assert.deepEqual(s2.notices(), [], '표시(rekeyFrom)도 지워짐');
  assert.ok(![...db.data.get('pmTasks')!.values()].some((r) => r.body.includes('rekeyFrom')));
});

test('ⓑ 중간 실패 — 견적 저장: 끊기면 화면 = DB, 첫 쓰기에서 끊기면 아무것도 안 남고 다시 저장하면 메모리판과 같음', async () => {
  const db = seededDb(TODAY);
  const s = await open(db);
  const mem = createPmStore(TODAY);
  const E = (x: Awaited<ReturnType<PmStore['snapshot']>>) => ({ ...fillMyungsung(quoteDraft(null, 'P4', undefined, x.moneyCfg, TODAY), 'F2'), name: '검수 견적' });
  db.failAt(1);
  await assert.rejects(s.saveQuote(E(s.peek().snap), '한일', TODAY), /저장하지 못했습니다/);
  await sameAsDb(s, db);
  assert.equal(s.peek().snap.contracts.length, 3);
  const a = await s.saveQuote(E(s.peek().snap), '한일', TODAY);
  const b = await mem.saveQuote(E(await mem.snapshot()), '한일', TODAY);
  const x = await reread(db, TODAY);
  const strip = (v: typeof x) => JSON.stringify([v.contracts.map((c) => ({ ...c, id: '' })), v.pays.map((p) => ({ ...p, id: '', cid: '' })), v.funds, v.items.map((i) => ({ ...i, hist: i.hist.map((h) => ({ ...h, cid: h.cid === a.c.id || h.cid === b.c.id ? '' : h.cid })) }))]);
  assert.equal(strip(x), strip(await mem.snapshot()));
  // 목록 품목 1줄 = 계약 새로 + 품목 지난 견적 고치기 → 둘째 쓰기에서 끊김 (계약은 남음)
  const kio = s.peek().snap.items.find((i) => i.name === '키오스크 Panel PC')!;
  const E2 = E(s.peek().snap);
  db.failAt(2);
  await assert.rejects(s.saveQuote({ ...E2, name: '둘째', q: { ...E2.q, items: [...E2.q.items, pickToLine(kio, 'hw', 1)] } }, '한일', TODAY), /일부만 저장됐습니다/);
  await sameAsDb(s, db);
});

test('ⓒ 번호 겹침: 두 저장소가 같은 사업에 티켓을 동시에 발행 → 번호가 다름 (나중 것은 다시 읽고 다음 번호)', async () => {
  const db = seededDb(TODAY);
  const A = await open(db);
  const B = await open(db);
  const [t1, t2] = [await taskOf(A, 'P2', 0), await taskOf(A, 'P2', 1)];
  db.setWriteDelay(3);
  const [a, b] = await Promise.all([A.issueTickets([ticketFor(t1)]), B.issueTickets([ticketFor(t2)])]);
  assert.deepEqual([a[0].no, b[0].no].sort(), ['P2-0001', 'P2-0002']);
  const x = await reread(db, TODAY);
  assert.equal(x.tickets.length, 2);
  await sameAsDb(B, db);
});

test('ⓒ N2 사업 번호 겹침: 같은 사업키를 동시에 등록 → 하나만 남고, 진 쪽은 사업 문서 insert 거부에서 멈춰 아무것도 더 안 씀 + 안내', async () => {
  const db = seededDb(TODAY);
  const A = await open(db);
  const B = await open(db);
  const p = (co: string) => pmProjectSchema.parse({ id: 'P20', company: co, biz: '부처협업형(산업보안)', start: '2027-01-04', end: '2027-09-30' });
  db.setWriteDelay(3);
  const r = await Promise.allSettled([A.addProject(p('㈜가회사'), 'std', false, 'u1'), B.addProject(p('㈜나회사'), 'std', false, 'u2')]);
  assert.deepEqual(r.map((v) => v.status), ['fulfilled', 'rejected']);
  assert.match(String((r[1] as PromiseRejectedResult).reason?.message), /사업키 P20 는 다른 사람이 방금 먼저 등록했습니다/);
  const x = await reread(db, TODAY);
  assert.deepEqual([x.projects.filter((v) => v.id === 'P20').length, x.projects.find((v) => v.id === 'P20')!.company, x.tasks.filter((t) => t.projectId === 'P20').length], [1, '㈜가회사', 73]);
  assert.ok(!x.orgs.some((o) => o.name === '㈜나회사'), '진 쪽 기준정보(새 기업)도 안 씀');
  assert.ok(!x.logs.some((l) => l.by === 'u2'));
  assert.equal(B.peek().snap.projects.find((v) => v.id === 'P20')?.company, '㈜가회사', '진 쪽은 다시 읽어 먼저 등록된 사업이 보임');
});

test('ⓓ 금액 경계: 금액 기록은 pmMoney · pmMoneyItems · pmMoneyContracts 에만 (사업 budget · subsidy = (나) 때 옮길 칸, CR cost = 7장 결정으로 누구나)', async () => {
  const money = new Set(['moneyCfg', 'fundRules', 'items', 'contracts', 'funds', 'pays', 'costs', 'oh']);
  for (const def of PM_COLLS) for (const k of def.kinds) assert.equal(money.has(k.field), !!def.money, `${def.name}.${k.kind || k.field}`);
  const s = createPmStore(TODAY);
  await s.addCr({ projectId: 'P2', cat: '기능 추가', title: 'x', desc: '', req: '', date: TODAY, prio: '보통', days: 1, cost: 100 }, 'u1');
  const snap = await s.snapshot();
  const allow: Record<string, string[]> = { pmProjects: ['budget', 'subsidy'], pmChangeRequests: ['cost'] };
  const MONEY_KEY = /budget|subsidy|cost|price|amt|amount|rev$|buy|pay|fund|sales|profit/i;
  for (const def of PM_COLLS.filter((d) => !d.money)) {
    for (const kd of def.kinds) {
      const keys = new Set(recsOf(def, kd, snap).flatMap((d) => Object.keys(d.rec)));
      const bad = [...keys].filter((k) => MONEY_KEY.test(k) && !(allow[def.name] ?? []).includes(k));
      assert.deepEqual(bad, [], `${def.name}.${kd.kind || kd.field}`);
    }
  }
});

test('ⓔ 오래된 화면: B 가 고친 업무를 A 가 옛 화면에서 고치면 안 쓰고 멈춤 · 다른 업무는 둘 다 남음 · 방금 내가 저장한 것은 거짓 충돌 없음 · 사업 삭제는 B 가 넣은 세부 작업까지', async () => {
  const db = seededDb(TODAY);
  const A = await open(db);
  const B = await open(db);
  const X = await taskOf(A, 'P2', 0);
  const Y = await taskOf(A, 'P2', 1);
  await B.setProgress(X.id, 50, 'B 기록', 'u2');
  const w0 = db.stats.writes;
  await assert.rejects(A.updateTask(X.id, { ...X, name: 'A 가 고친 이름' }, 'u1', nameOf), /다른 사람이 먼저 고쳤습니다/);
  assert.equal(db.stats.writes, w0, '아무것도 안 씀');
  assert.equal(A.peek().snap.tasks.find((t) => t.id === X.id)!.actualPct, 50, '다시 읽어 B 값이 보임');
  await A.updateTask(Y.id, { ...Y, name: 'A 가 고친 Y' }, 'u1', nameOf);
  let x = await reread(db, TODAY);
  assert.deepEqual([x.tasks.find((t) => t.id === X.id)!.actualPct, x.tasks.find((t) => t.id === Y.id)!.name], [50, 'A 가 고친 Y']);
  const X2 = A.peek().snap.tasks.find((t) => t.id === X.id)!;
  await A.updateTask(X.id, { ...X2, name: '첫째' }, 'u1', nameOf);
  await A.updateTask(X.id, { ...A.peek().snap.tasks.find((t) => t.id === X.id)!, name: '둘째' }, 'u1', nameOf);
  // K3: A 가 모르는 사이 B 가 P5 업무에 세부 작업 → A 가 P5 삭제 → B 것도 지움
  const z = await taskOf(B, 'P5');
  const sub = await B.addSubtask(z.id, 'B 가 넣은 일', 'u2', '', 'u2', TODAY);
  await A.removeProject('P5', 'u1');
  x = await reread(db, TODAY);
  assert.ok(!x.subtasks.some((v) => v.id === sub.id), '주인 없는 세부 작업 안 남음');
  assert.deepEqual(createPmStore(TODAY, { db }).notices(), []);
});

test('ⓕ 잇단 저장 2개: 첫째 쓰기를 늦춰도 둘째는 첫째 결과 위에서 계산 · 늦게 온 옛 읽기 결과는 버림', async () => {
  const db = seededDb(TODAY);
  const s = await open(db);
  const t = await taskOf(s, 'P3');
  db.setWriteDelay(15);
  const [a, b] = await Promise.all([s.addSubtask(t.id, '첫째', 'u1', '', 'u1', TODAY), s.addSubtask(t.id, '둘째', 'u1', '', 'u1', TODAY)]);
  assert.equal(b.order, a.order + 1, '둘째가 첫째를 봄');
  db.setWriteDelay(0);
  // 읽기(세대 g) 를 받아 두고 그 뒤 저장(세대 g+1) → 화면 훅은 옛 결과 대신 지금 상태
  db.setReadDelay(10);
  const r = s.refresh();
  const w = s.setLoadMax(5);
  const old = await r;
  await w;
  assert.ok(old.gen < s.gen());
  assert.equal(old.snap.settings.loadMax, 8);
  assert.equal((await latestSnapshot(s)).settings.loadMax, 5);
});

test('ⓖ 쓰기 제한 429: 기다렸다(머리말 시각, 없으면 10초) 남은 것부터 이어 써서 끝 상태가 같음 · 쓰기 20건 넘으면 진행 표시', async () => {
  const g1 = idGen(); const mem = createPmStore(TODAY, { nid: g1 });
  const g2 = idGen(); const db = seededDb(TODAY, { nid: g2 });
  const s = await open(db, g2);
  const p = pmProjectSchema.parse({ id: 'P20', company: '㈜가회사', biz: '부처협업형(산업보안)', start: '2027-01-04', end: '2027-09-30' });
  const seen: string[] = [];
  s.onProgress((x) => seen.push(`${x.done}/${x.total}`));
  db.rateLimitAt(7, 2500);
  assert.equal(await s.addProject(p, 'std', false, 'u1'), 73);
  await mem.addProject(p, 'std', false, 'u1');
  assert.deepEqual(db.waited, [2500]);
  assert.equal(snapDiff(await reread(db, TODAY), await mem.snapshot()), null);
  assert.equal(seen[0], '0/77');
  assert.equal(seen.at(-1), '77/77');
  db.rateLimitAt(1);
  await s.setLoadMax(3);
  assert.deepEqual(db.waited, [2500, 10_000]);
});

test('N1 사업 삭제: 세부 기능 · 완료 기록 · 마일스톤 승인 · 표준 연결 · 취소 티켓도 지움 → 같은 사업키 · 같은 업무 번호로 다시 등록해도 옛 기록이 안 붙음 (변경 이력은 남음)', async () => {
  for (const mode of ['memory', 'db'] as const) {
    const db = seededDb(TODAY);
    const s = mode === 'db' ? await open(db) : createPmStore(TODAY);
    // 세부 기능이 있는 사업 중 번호가 가장 큰 사업
    const s0 = await s.snapshot();
    const t = s0.tasks.filter((x) => s0.functions.some((f) => f.id === x.id)).sort((a, b) => +b.projectId.slice(1) - +a.projectId.slice(1))[0];
    const k = t.projectId;
    const std = s.peek().snap.stdTasks[0];
    await s.setProgress(t.id, 100, '완료', 'u1');
    await s.approveMilestone(t.id, 'u3', 'u3');
    await s.setTlinks([[t.id, std.id]]);
    const [tk] = await s.issueTickets([ticketFor(t)]);
    await s.moveTicket(tk.no, '취소', '', 'u1', nameOf);
    const p = s.peek().snap.projects.find((x) => x.id === k)!;
    await s.removeProject(k, 'u1');
    await s.addProject({ ...p, company: '다시 등록' }, '', false, 'u1');
    await s.addTask({ ...t, actualPct: 0, status: '계획' }, 'u1');
    const x = mode === 'db' ? await reread(db, TODAY) : await s.snapshot();
    assert.deepEqual([x.functions.some((f) => f.id === t.id), x.done.some((d) => d.id === t.id), x.msOk.some((m) => m.id === t.id), x.tlinks.some((l) => l.id === t.id), x.tickets.some((v) => v.projectId === k), taskTicketIndex(x.tickets).has(t.id)],
      [false, false, false, false, false, false], mode);
    // 남는 것 — 변경 이력 (같은 사업키라 새 사업 '변경 이력'에 옛 줄이 같이 보임 → 보고)
    const logs = x.logs.filter((l) => l.projectId === k).map((l) => l.text);
    assert.ok(logs.some((v) => /사업 삭제/.test(v)) && logs.some((v) => /100%|완료/.test(v)), mode);
  }
});

test('N3 배포로 칸이 늘어난 뒤 옛 코드가 저장: zod 는 모르는 칸을 버리지만, 저장 계층이 DB 의 모르는 맨 위 칸을 그대로 붙여 씀 → 새 칸이 안 지워짐', async () => {
  const { pmTaskSchema } = await import('@/domain/pm/schema');
  assert.equal('futureField' in pmTaskSchema.parse({ id: 'P2|1', projectId: 'P2', code: '1', name: 'x', futureField: 1 }), false, 'zod z.object = 모르는 칸 버림');
  const db = seededDb(TODAY);
  const t0 = [...db.data.get('pmTasks')!.values()][0];
  const raw = JSON.parse(t0.body);
  db.data.get('pmTasks')!.set(docKeyOf(t0), { ...t0, body: JSON.stringify({ ...raw, futureField: { v: 1 } }) });
  const s = await open(db);
  const t = s.peek().snap.tasks.find((x) => x.id === raw.id)!;
  assert.equal('futureField' in t, false, '옛 코드 화면에는 없음');
  await s.updateTask(t.id, { ...t, name: '옛 탭에서 고침' }, 'u1', nameOf);
  const after = JSON.parse(db.data.get('pmTasks')!.get(docKeyOf(t0))!.body);
  assert.deepEqual([after.name, after.futureField], ['옛 탭에서 고침', { v: 1 }]);
});

test('스위치 가드: 컬렉션이 없으면 "PM 저장소 준비 안 됨"(처음 값으로 안 돌아감) · DB 드라이버가 appwrite 가 아니면 멈춤 · 빈 DB 는 빈 화면 + 저장 막음', async () => {
  const db = seededDb(TODAY);
  db.drop('pmIssues');
  db.drop('pmMoney');
  await assert.rejects(createPmStore(TODAY, { db }).snapshot(), /PM 저장소 준비 안 됨 \(컬렉션 없음: pmIssues, pmMoney\)/);
  const b = createPmStore(TODAY, { blocked: 'PM 저장소 준비 안 됨 (VITE_DB_DRIVER 가 appwrite 가 아님 — 지금 memory)' });
  await assert.rejects(b.snapshot(), /VITE_DB_DRIVER 가 appwrite 가 아님/);
  await assert.rejects(b.setLoadMax(3), /VITE_DB_DRIVER/);
  const e = createPmStore(TODAY, { db: createFakePmDb() });
  const snap = await e.snapshot();
  assert.deepEqual([snap.projects.length, snap.tasks.length, snap.items.length], [0, 0, 0], '처음 값(내장 데이터) 안 씀');
  assert.match(e.notices()[0], /비어 있습니다/);
  await assert.rejects(e.setLoadMax(3), /비어 있어 저장할 수 없습니다/);
});

test('처음 열 때 점검: 없는 업무를 가리키는 세부 작업 · 티켓 · 세부 기능, 읽지 못한 기록 → 안내 (pm.manage)', async () => {
  const snap = createPmStore(TODAY).peek().snap;
  const rows = snapshotRows(snap);
  const sub = rows.get('pmSubtasks')![0];
  rows.get('pmSubtasks')!.push({ ...sub, id: 'sX', taskId: 'P2|없음', body: JSON.stringify({ ...JSON.parse(sub.body), id: 'sX', taskId: 'P2|없음' }) });
  rows.get('pmIssues')!.push({ id: 'I-009', kind: '', at: 0, seq: 0, body: '{"id":"I-009"}' });
  const db = createFakePmDb();
  db.fill(rows);
  const s = await open(db);
  const n = s.notices().join('\n');
  assert.match(n, /없는 업무를 가리키는 기록: 세부 작업 1건/);
  assert.match(n, /읽지 못한 기록 1건 \(pmIssues 1\)/);
  // 읽지 못한 기록은 지우지 않음 (사업 삭제로 이슈를 지워도 남음)
  await s.removeProject('P3', 'u1');
  assert.ok(db.data.get('pmIssues')!.has('I-009'));
});

test('id 무작위: 같은 순간(시계 멈춤) 다른 저장소에서 만든 id 도 안 겹침', async () => {
  const a = createPmStore(TODAY);
  const b = createPmStore(TODAY);
  const ids = new Set<string>();
  for (let i = 0; i < 20; i++) { ids.add((await a.addAction({ text: 'x', whoId: '', due: '', projectId: 'P2', meetingId: '' }, 'u1')).id); ids.add((await b.addAction({ text: 'x', whoId: '', due: '', projectId: 'P2', meetingId: '' }, 'u1')).id); }
  assert.equal(ids.size, 40);
  assert.match([...ids][0], /^A[0-9a-z]+[0-9a-z]{4}$/);
});
