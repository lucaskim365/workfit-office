import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { quoteDraft } from '@/domain/pm/quote';
import { liveOf } from '@/domain/pm/rules';
import { makeTaskTicket } from '@/domain/pm/ticket';
import { fillMyungsung } from '@/domain/pm/quoteDemo';
import { createPmStore, pmBase, type PmBases, type PmSnapshot, type PmStore } from './pm.store';
import { PmConflictError, PmStaleWindowError } from './pmSync';
import { reread, seededDb, snapDiff } from './pmTestStores';

/**
 * F5 (검수 ③, 설계 5.7.17) — 옛 값이 든 수정 창의 저장이 남의 변경을 덮지 않음.
 * 창이 열 때 기준표(pmBase)를 만들고 `withBase(표)` 로 저장 → DB 모드 저장소가 계산 전에 지금 기록과 비교.
 * R12 = 팀장 시험(C:\Users\jw\ego\pm-review-20261126\R12_stale_overwrite.test.ts)을 막힘 확인으로 바꾼 것.
 */
const TODAY = '2026-11-25';
mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12) });
const nameOf = (id: string) => id;
const STALE = /이 창을 연 뒤 다른 곳\(다른 사람 · 다른 탭\)에서 먼저 고쳤습니다\. 저장하지 않았습니다 — 창을 닫고 다시 열어/;

async function two() {
  const db = seededDb(TODAY);
  const A = createPmStore(TODAY, { db });
  const B = createPmStore(TODAY, { db });
  await A.refresh(); await B.refresh();
  return { db, A, B };
}
const snapOf = (s: PmStore) => s.peek().snap;

// ── R12 (C1): 다섯 장면 모두 막힘 + 안내 + B 값 남음 ──

test('R12-a 사업 수정 기업명만 바꿈(K3 다시 읽기) — B 가 먼저 종료일: 표로도 · 표 없이도(덧막이) 막힘, B 종료일 남음', async () => {
  for (const withBase of [true, false]) {
    const { db, A, B } = await two();
    const p = snapOf(A).projects.find((x) => x.id === 'P3')!;
    const base = [pmBase('projects', p.id, p)];
    await B.updateProject({ ...p, end: '2027-12-31' }, 'u2');
    const S = withBase ? A.withBase(base) : A;
    await assert.rejects(S.updateProject({ ...p, company: `${p.company}ZZ` }, 'u1'), (e) => e instanceof PmStaleWindowError && STALE.test((e as Error).message));
    const after = (await reread(db, TODAY)).projects.find((x) => x.id === 'P3')!;
    assert.equal(after.end, '2027-12-31', `B 종료일 (표 ${withBase})`);
    assert.equal(after.company, p.company);
  }
});

test('R12-c 업무 번호 바꾸기(K3) — B 진행률 60: 막힘, 새 번호 업무 안 생김, 60 남음', async () => {
  for (const withBase of [true, false]) {
    const { db, A, B } = await two();
    const t = snapOf(A).tasks[0];
    const base = [pmBase('tasks', t.id, t)];
    await B.updateTask(t.id, { ...t, actualPct: 60 }, 'u2', nameOf);
    const S = withBase ? A.withBase(base) : A;
    await assert.rejects(S.updateTask(t.id, { ...t, id: `${t.id}-ZZ` }, 'u1', nameOf), PmStaleWindowError);
    const s = await reread(db, TODAY);
    assert.equal(s.tasks.find((x) => x.id === t.id)!.actualPct, 60);
    assert.ok(!s.tasks.some((x) => x.id === `${t.id}-ZZ`));
  }
});

test('R12-d (b) 창이 열린 채 다시 읽기(새 화면이 붙음 · 다른 저장 실패) — B 진행률 60 → A 다시 읽음 → A 옛 창 저장: 막힘, 60 남음', async () => {
  const { db, A, B } = await two();
  const t = snapOf(A).tasks[0];
  const base = [pmBase('tasks', t.id, t)];
  await B.updateTask(t.id, { ...t, actualPct: 60 }, 'u2', nameOf);
  await A.refresh();
  await assert.rejects(A.withBase(base).updateTask(t.id, { ...t, name: `${t.name} ZZ` }, 'u1', nameOf), STALE);
  const after = (await reread(db, TODAY)).tasks.find((x) => x.id === t.id)!;
  assert.equal(after.actualPct, 60);
  assert.equal(after.name, t.name);
});

test('R12-e 기준 코드 이름 바꾸기(K3) — B 가 먼저 설명을 고침: 막힘, B 설명 남음', async () => {
  for (const withBase of [true, false]) {
    const { db, A, B } = await two();
    const c = snapOf(A).codes.find((x) => x.group === 'stage')!;
    const base = [pmBase('codes', c.id, c)];
    await B.saveCode({ ...c, note: 'B 가 쓴 설명' }, 'u2'); // (순서 ord 는 saveCode 가 안 바꿈 — 순서는 moveStage)
    const S = withBase ? A.withBase(base) : A;
    await assert.rejects(S.saveCode({ ...c, name: `${c.name}ZZ` }, 'u1'), PmStaleWindowError);
    const after = (await reread(db, TODAY)).codes.find((x) => x.id === c.id)!;
    assert.equal(after.note, 'B 가 쓴 설명');
    assert.equal(after.name, c.name);
  }
});

test('R12-f (a) 충돌 안내 뒤 같은 창에서 [저장] 한 번 더 — 첫째 ①(DB 비교) 막힘, 둘째 표로 막힘, 60 남음', async () => {
  const { db, A, B } = await two();
  const t = snapOf(A).tasks[0];
  const base = [pmBase('tasks', t.id, t)];
  await B.updateTask(t.id, { ...t, actualPct: 60 }, 'u2', nameOf);
  const form = { ...t, name: `${t.name} ZZ` };
  await assert.rejects(A.withBase(base).updateTask(t.id, form, 'u1', nameOf), (e) => e instanceof PmConflictError && /저장하지 않았습니다 — 다시 읽었으니 창을 닫고 다시 열어/.test((e as Error).message));
  await assert.rejects(A.withBase(base).updateTask(t.id, form, 'u1', nameOf), PmStaleWindowError);
  await assert.rejects(A.withBase(base).updateTask(t.id, form, 'u1', nameOf), PmStaleWindowError, '셋째도');
  const after = (await reread(db, TODAY)).tasks.find((x) => x.id === t.id)!;
  assert.equal(after.actualPct, 60);
  assert.equal(after.name, t.name);
});

// ── M3: 있고 없음 ──

test('M3 표에는 있는데 지금 없음 (B 가 지움) → 막힘, 다시 만들어지지 않음', async () => {
  const { db, A, B } = await two();
  const i = await A.addIssue({ projectId: 'P2', title: 'ZZ 이슈', cat: '기타', sev: '보통', status: '열림', ownerId: 'u2', watchIds: [], date: TODAY, equip: '', taskId: '', desc: '', action: '' }, 'u1');
  const base = [pmBase('issues', i.id, snapOf(A).issues.find((x) => x.id === i.id))];
  await B.refresh();
  await B.removeIssue(i.id);
  await A.refresh();
  const { id: _id, by: _by, at: _at, esc: _esc, ...x } = i;
  await assert.rejects(A.withBase(base).updateIssue(i.id, { ...x, status: '대응중' }), STALE);
  assert.ok(!(await reread(db, TODAY)).issues.some((y) => y.id === i.id), '다시 생기지 않음');
});

test('M3 표에는 없는데 지금 있음 (새 견적 창을 연 뒤 B 가 그 사업 재원을 만듦) → 막힘, B 재원 남음', async () => {
  const { db, A, B } = await two();
  const s0 = snapOf(A);
  assert.ok(!s0.funds.some((f) => f.id === 'P4'), '시험 전제: P4 재원 기록 없음');
  const base: PmBases = [pmBase('funds', 'P4', null)];
  const E = { ...fillMyungsung(quoteDraft(null, 'P4', undefined, s0.moneyCfg, TODAY), 'F2'), name: 'ZZ 견적' };
  const f0 = (await B.snapshot()).funds[0];
  await B.saveFund({ ...f0, id: 'P4', man: 1230000 });
  await A.refresh();
  const n0 = (await reread(db, TODAY)).contracts.length;
  await assert.rejects(A.withBase(base).saveQuote(E, 'ZZ'), STALE);
  const s = await reread(db, TODAY);
  assert.equal(s.contracts.length, n0, '계약 안 생김');
  assert.equal(s.funds.find((f) => f.id === 'P4')!.man, 1230000);
});

// ── M4: 견적 같은 창 잇달아 저장 ──

test('M4 새 견적 저장 → 같은 표로 한 줄 고쳐 또 저장: 안 막힘 · 계약 1건 · 재원 표 줄은 새 기록으로', async () => {
  const { db, A } = await two();
  const s0 = snapOf(A);
  const base: PmBases = [pmBase('funds', 'P4', s0.funds.find((f) => f.id === 'P4') ?? null)];
  const n0 = s0.contracts.length;
  let E = { ...fillMyungsung(quoteDraft(null, 'P4', undefined, s0.moneyCfg, TODAY), 'F2'), name: 'ZZ 견적' };
  const r = await A.withBase(base).saveQuote(E, 'ZZ');
  // 훅(usePm saveQuote)이 하는 것: 새 계약 줄을 표에 더함
  if (!base.some((b) => b.field === 'contracts')) base.push(pmBase('contracts', r.c.id, r.c));
  assert.deepEqual(base[0].rec, structuredClone(snapOf(A).funds.find((f) => f.id === 'P4') ?? null), '재원 줄 = 저장 뒤 기록 (M7: 다 쓴 뒤)');
  E = { ...E, cid: r.c.id, name: 'ZZ 견적 (고침)' };
  await A.withBase(base).saveQuote(E, 'ZZ');
  const s = await reread(db, TODAY);
  assert.equal(s.contracts.length, n0 + 1, '계약 1건');
  assert.equal(s.contracts.find((c) => c.id === r.c.id)!.name, 'ZZ 견적 (고침)');
});

// ── M7: 실패 · 일부만 저장이면 표 그대로 ──

test('M7 저장 실패 · 일부만 저장 뒤 표 기록은 그대로 (다음 저장도 같은 기준으로 비교)', async () => {
  const { db, A } = await two();
  const t = snapOf(A).tasks[0];
  const base = [pmBase('tasks', t.id, t)];
  const before = structuredClone(base[0].rec);
  db.failAt(1);
  await assert.rejects(A.withBase(base).updateTask(t.id, { ...t, name: `${t.name} ZZ` }, 'u1', nameOf));
  assert.deepEqual(base[0].rec, before, '연결 오류 뒤 그대로');
  db.failAt(2); // 업무 + 변경 이력 — 둘째에서 끊김 = 일부만 저장
  await assert.rejects(A.withBase(base).updateTask(t.id, { ...t, name: `${t.name} ZZ` }, 'u1', nameOf), /일부만 저장/);
  assert.deepEqual(base[0].rec, before, '일부만 저장 뒤 그대로');
  // 일부만 저장으로 업무 이름이 바뀌어 있음 → 같은 창 다시 저장은 막힘 (창을 닫고 다시 열기)
  await assert.rejects(A.withBase(base).updateTask(t.id, { ...t, name: `${t.name} ZZ2` }, 'u1', nameOf), STALE);
});

// ── M5 · C3: 표의 줄마다 — 혼자 고치기(열기 → 다시 읽기 → 저장 → 잇달아 저장)는 안 막힘, 남이 먼저 고치면 막힘 ──

type S = ReturnType<PmStore['withBase']>;
interface Row {
  name: string;
  /** 시험 기록 만들기 (A 저장소에서) */
  setup?: (s: PmStore) => Promise<Record<string, any>>;
  /** 창 열기 = 기준표 + 그 표로 하는 저장 (tag = 누가 고친 값인지) */
  open: (x: PmSnapshot, c: Record<string, any>) => { base: PmBases; save: (s: S, tag: string, x: PmSnapshot) => Promise<unknown> };
  /** 잇달아 저장이 뜻 없는 저장 (번호 바꾸기 · 검토는 한 번만) */
  once?: boolean;
}
const CFG_KEYS = ['cloudMonthly', 'cloudMonths', 'kosaName', 'kosaMonthly', 'workH', 'revBasis', 'laborOn'];
const p2t = (x: PmSnapshot, i = 0) => x.tasks.filter((t) => t.projectId === 'P2')[i];
const n = (tag: string) => (tag === 'A' ? 11 : 22);
const ROWS: Row[] = [
  { name: 'updateTask (업무 수정 창 · 보드 끌기)', open: (x) => { const t = p2t(x); return { base: [pmBase('tasks', t.id, t)], save: (s, tag) => s.updateTask(t.id, { ...t, name: `${t.name} ${tag}` }, 'u1', nameOf) }; } },
  { name: 'updateTask 번호 바꾸기 (K3)', once: true, open: (x) => { const t = p2t(x); return { base: [pmBase('tasks', t.id, t)], save: (s, tag) => s.updateTask(t.id, { ...t, id: `P2|99-${n(tag)}`, code: `99-${n(tag)}` }, 'u1', nameOf) }; } },
  { name: 'updateProject (메모)', open: (x) => { const p = x.projects.find((y) => y.id === 'P3')!; return { base: [pmBase('projects', p.id, p)], save: (s, tag) => s.updateProject({ ...p, note: `메모 ${tag}` }, 'u1') }; } },
  { name: 'updateProject 기업명 (K3)', open: (x) => { const p = x.projects.find((y) => y.id === 'P3')!; return { base: [pmBase('projects', p.id, p)], save: (s, tag) => s.updateProject({ ...p, company: `${p.company}${tag}` }, 'u1') }; } },
  { name: 'saveCode 이름 (K3)', open: (x) => { const c = x.codes.find((y) => y.group === 'stage')!; return { base: [pmBase('codes', c.id, c)], save: (s, tag) => s.saveCode({ ...c, name: `${c.name}${tag}` }, 'u1') }; } },
  { name: 'saveStd', open: (x) => { const t = x.stdTasks[0]; return { base: [pmBase('stdTasks', t.id, t)], save: (s, tag) => s.saveStd({ ...t, name: `${t.name} ${tag}` }) }; } },
  { name: 'saveOrg', open: (x) => { const o = x.orgs.find((y) => y.name === '경남TP') ?? x.orgs[0]; return { base: [pmBase('orgs', o.id, o)], save: (s, tag) => s.saveOrg({ ...o, ceo: `대표 ${tag}` }) }; } },
  { name: 'saveMoneyCfg (단가 창 칸만)', open: (x) => ({ base: [pmBase('moneyCfg', undefined, x.moneyCfg, CFG_KEYS)], save: (s, tag, y) => s.saveMoneyCfg({ ...y.moneyCfg, cloudMonthly: 300000 + n(tag) }) }) },
  { name: 'saveFundRule', open: (x) => { const r = x.fundRules[0]; return { base: [pmBase('fundRules', r.id, r)], save: (s, tag) => s.saveFundRule({ ...r, src: `출처 ${tag}` }) }; } },
  { name: 'saveItem', open: (x) => { const it = x.items[0]; return { base: [pmBase('items', it.id, it)], save: (s, tag) => s.saveItem({ ...it, desc: `설명 ${tag}` }) }; } },
  {
    name: 'saveQuote 견적 고치기 (계약 + 재원)',
    open: (x) => {
      const c = x.contracts.find((y) => y.projectId === 'P2')!;
      const f = x.funds.find((y) => y.id === 'P2') ?? null;
      const E = quoteDraft(c, 'P2', f ?? undefined, x.moneyCfg, TODAY);
      return { base: [pmBase('contracts', c.id, c), pmBase('funds', 'P2', f)], save: (s, tag) => s.saveQuote({ ...E, note: `메모 ${tag}` }, 'ZZ') };
    },
  },
  { name: 'saveFund', open: (x) => { const f = x.funds.find((y) => y.id === 'P2')!; return { base: [pmBase('funds', f.id, f)], save: (s, tag) => s.saveFund({ ...f, man: 1000000 * n(tag) }) }; } },
  { name: 'savePay', open: (x) => { const p = x.pays[0]; return { base: [pmBase('pays', p.id, p)], save: (s, tag) => s.savePay({ ...p, name: `대금 ${tag}` }) }; } },
  {
    name: 'saveCost', setup: async (s) => ({ c: await s.saveCost({ id: '', projectId: 'P2', date: TODAY, cat: '기타', amt: 10000, vendor: '', desc: 'ZZ' }) }),
    open: (x, c) => { const r = x.costs.find((y) => y.id === c.c.id)!; return { base: [pmBase('costs', r.id, r)], save: (s, tag) => s.saveCost({ ...r, desc: `ZZ ${tag}` }) }; },
  },
  { name: 'saveOh (연 달 + 기본 월 간접비)', open: (x) => ({ base: [pmBase('oh', '2026-03', x.oh.find((y) => y.id === '2026-03') ?? null), pmBase('moneyCfg', undefined, x.moneyCfg, ['ohDefault'])], save: (s, tag) => s.saveOh('2026-03', 1000000 * n(tag), `ZZ ${tag}`, 500000, 'u1', TODAY) }) },
  {
    name: 'saveAgreement', setup: async (s) => { await s.saveAgreement({ id: 'AGZZ', projectId: 'P2', date: TODAY, kind: 'staff', from: '', to: '', text: '인력', why: '', st: '준비 중', by: '', applied: false }, 'u1'); return {}; },
    open: (x) => { const r = x.agreements.find((y) => y.id === 'AGZZ')!; return { base: [pmBase('agreements', r.id, r)], save: (s, tag) => s.saveAgreement({ ...r, why: `사유 ${tag}` }, 'u1') }; },
  },
  { name: 'setGovResult (점검 결과)', open: (x) => ({ base: [pmBase('gov', 'P2|g_mid', x.gov.find((y) => y.id === 'P2|g_mid') ?? null)], save: (s, tag) => s.setGovResult('P2', 'g_mid', { v: '적합', date: TODAY, memo: `메모 ${tag}`, fix: '', items: [] }, 'u1') }) },
  { name: 'setGovLink (필수 TASK 연결)', open: (x) => ({ base: [pmBase('govLinks', 'P2|g_mid', null, ['taskIds'])], save: (s, tag) => s.setGovLink('P2', 'g_mid', [p2t(x, tag === 'A' ? 0 : 1).id]) }) },
  { name: 'setTaskDates (필수 일정 — 시작 · 종료 칸만)', open: (x) => { const t = p2t(x, 2); return { base: [pmBase('tasks', t.id, t, ['start', 'end'])], save: (s, tag) => s.setTaskDates([{ id: t.id, start: '2026-12-01', end: `2026-12-${n(tag)}` }], 'ZZ', 'u1', TODAY) }; } },
  {
    name: 'saveKpiDef', setup: async (s) => ({ kid: await s.saveKpiDef({ projectId: 'P4', f: 'Q', name: 'ZZ 불량률', unit: '%', dir: 'down', base: 2, target: 1, w: 1, period: '', method: '' }) }),
    open: (x, c) => { const d = x.kpiDefs.find((y) => y.id === c.kid)!; return { base: [pmBase('kpiDefs', d.id, d)], save: (s, tag) => s.saveKpiDef({ ...d, method: `방법 ${tag}` }) }; },
  },
  {
    name: 'saveKpiMeas', setup: async (s) => { const kid = await s.saveKpiDef({ projectId: 'P4', f: 'Q', name: 'ZZ', unit: '%', dir: 'down', base: 2, target: 1, w: 1, period: '', method: '' }); await s.saveKpiMeas({ projectId: 'P4', kid, date: TODAY, val: 1.5, memo: '' }, 'u1'); return {}; },
    open: (x) => { const m = x.kpiMeas[0]; return { base: [pmBase('kpiMeas', m.id, m)], save: (s, tag) => { const { who: _w, ...r } = m; return s.saveKpiMeas({ ...r, memo: `메모 ${tag}` }, 'u1'); } }; },
  },
  {
    name: 'updateIssue', setup: async (s) => ({ i: await s.addIssue({ projectId: 'P2', title: 'ZZ', cat: '기타', sev: '보통', status: '열림', ownerId: 'u2', watchIds: [], date: TODAY, equip: '', taskId: '', desc: '', action: '' }, 'u1') }),
    open: (x, c) => { const i = x.issues.find((y) => y.id === c.i.id)!; const { id: _a, by: _b, at: _c, esc: _d, ...v } = i; return { base: [pmBase('issues', i.id, i)], save: (s, tag) => s.updateIssue(i.id, { ...v, action: `조치 ${tag}` }) }; },
  },
  {
    name: 'updateMeeting', setup: async (s) => ({ mt: await s.addMeeting({ projectId: 'P2', type: '주간 회의', title: 'ZZ', date: TODAY, place: '', attIds: ['u1'], ext: '', content: '', decision: '' }, 'u1') }),
    open: (x, c) => { const m = x.meetings.find((y) => y.id === c.mt)!; const { id: _a, by: _b, at: _c, ...v } = m; return { base: [pmBase('meetings', m.id, m)], save: (s, tag) => s.updateMeeting(m.id, { ...v, decision: `결정 ${tag}` }) }; },
  },
  {
    name: 'updateAction', setup: async (s) => ({ a: await s.addAction({ text: 'ZZ', whoId: 'u2', due: '2026-12-01', projectId: 'P2', meetingId: '' }, 'u1') }),
    open: (x, c) => { const a = x.actions.find((y) => y.id === c.a.id)!; return { base: [pmBase('actions', a.id, a)], save: (s, tag) => s.updateAction(a.id, { text: `ZZ ${tag}`, whoId: a.whoId, due: a.due, projectId: a.projectId, meetingId: a.meetingId, done: false }, 'u1') }; },
  },
  {
    name: 'updateCr', setup: async (s) => ({ c: await s.addCr({ projectId: 'P2', cat: '기능 추가', title: 'ZZ', desc: '', req: '', date: TODAY, prio: '보통', days: 5, cost: 100 }, 'u1') }),
    open: (x, c) => { const r = x.crs.find((y) => y.id === c.c.id)!; return { base: [pmBase('crs', r.id, r)], save: (s, tag) => s.updateCr(r.id, { projectId: r.projectId, cat: r.cat, title: `ZZ ${tag}`, desc: r.desc, req: r.req, date: r.date, prio: r.prio, days: n(tag), cost: r.cost }) }; },
  },
  {
    name: 'reviewCr (검토 창)', once: true, setup: async (s) => ({ c: await s.addCr({ projectId: 'P2', cat: '기능 추가', title: 'ZZ', desc: '', req: '', date: TODAY, prio: '보통', days: 5, cost: 100 }, 'u1') }),
    open: (x, c) => { const r = x.crs.find((y) => y.id === c.c.id)!; return { base: [pmBase('crs', r.id, r)], save: (s, tag) => s.reviewCr(r.id, tag === 'A' ? '승인' : '반려', `의견 ${tag}`, 'u1') }; },
  },
  // ── G1 (F5 검수): 화면 값으로 통째 쓰는 저장 — 표 = 저장 누를 때 화면의 그 기록 ──
  {
    name: 'putTicket (티켓 상세 · 진행률 끌기)',
    setup: async (s) => { const t = p2t(await s.snapshot()); const ctx = { today: TODAY, me: 'u1', approverOf: () => 'u3', nameOf, live: liveOf(t) }; await s.issueTickets([makeTaskTicket('P0-0000', { task: t, assigneeId: 'u1', prio: '보통', due: '2026-12-01' }, { reviewerId: '', approverId: '', memo: '' }, ctx)]); return {}; },
    open: (x) => { const k = x.tickets[0]; return { base: [pmBase('tickets', k.no, k)], save: (s, tag) => s.putTicket({ ...k, due: `2026-12-${n(tag)}` }) }; },
  },
  { name: 'bulkUpdate (일괄 수정)', open: (x) => { const ts = [p2t(x, 3), p2t(x, 4)]; return { base: ts.map((t) => pmBase('tasks', t.id, t)), save: (s, tag) => s.bulkUpdate(ts.map((t) => ({ next: { ...t, md: n(tag) }, summary: `공수 ${n(tag)}` })), 'u1') }; } },
  {
    name: 'setPlanDay (그날 업무계획 — 본인 다른 탭)',
    setup: async (s) => { await s.setPlanDay('u1', TODAY, [{ text: 'ZZ 처음' }]); return {}; },
    open: (x) => { const r = x.planDays.find((y) => y.id === `u1|${TODAY}`) ?? null; return { base: [pmBase('planDays', `u1|${TODAY}`, r ? { items: r.items } : null, ['items'])], save: (s, tag) => s.setPlanDay('u1', TODAY, [{ text: `ZZ ${tag}` }]) }; },
  },
];

for (const row of ROWS) {
  test(`M5 혼자 고치기 안 막힘 — ${row.name}: 열기 → 다시 읽기 → 저장${row.once ? '' : ' → 같은 창 잇달아 저장'}`, async () => {
    const { db, A } = await two();
    const c = (await row.setup?.(A)) ?? {};
    await A.refresh();
    const w = row.open(snapOf(A), c);
    await A.refresh(); // 남의 변경 없는 다시 읽기 (DB 에서 읽은 모양 ↔ 저장소가 만든 모양 차이로 막히면 안 됨)
    await w.save(A.withBase(w.base), 'A', snapOf(A));
    if (!row.once) await w.save(A.withBase(w.base), 'B', snapOf(A)); // 같은 창 · 다른 값
    assert.equal(snapDiff(await reread(db, TODAY), snapOf(A)), null);
  });
  test(`M5 남이 먼저 고치면 막힘 — ${row.name}: B 저장 → A 다시 읽음 → A 옛 창 저장 = 막힘 · DB 는 B 그대로`, async () => {
    const { db, A, B } = await two();
    const c = (await row.setup?.(A)) ?? {};
    await A.refresh(); await B.refresh();
    const wA = row.open(snapOf(A), c);
    const wB = row.open(snapOf(B), c);
    await wB.save(B.withBase(wB.base), 'B', snapOf(B));
    await A.refresh();
    const before = await reread(db, TODAY);
    await assert.rejects(wA.save(A.withBase(wA.base), 'A', snapOf(A)), PmStaleWindowError);
    assert.equal(snapDiff(await reread(db, TODAY), before), null, '아무것도 안 씀');
  });
}

// ── C3: 잘못 막지 않음 ──

test('G1 saveMoneyCfg — 단가 창은 7칸만: B 가 기본 월 간접비를 바꾼 뒤 A 가 옛 화면 값으로 단가 저장 → 저장 됨 · B 간접비 남음', async () => {
  const { db, A, B } = await two();
  const c0 = snapOf(A).moneyCfg;
  const base = [pmBase('moneyCfg', undefined, c0, CFG_KEYS)];
  await B.saveOh('2026-03', null, '', 4_000_000, 'u2', TODAY);
  await A.refresh();
  await A.withBase(base).saveMoneyCfg({ ...c0, cloudMonthly: 333000 });
  const s = await reread(db, TODAY);
  assert.equal(s.moneyCfg.cloudMonthly, 333000);
  assert.equal(s.moneyCfg.ohDefault, 4_000_000, 'B 의 기본 월 간접비');
});

test('C3 서로 다른 기록: A 는 업무 X 창, B 는 업무 Y 를 고침 → A 저장 됨 · 둘 다 남음', async () => {
  const { db, A, B } = await two();
  const [x, y] = [p2t(snapOf(A), 0), p2t(snapOf(A), 1)];
  const base = [pmBase('tasks', x.id, x)];
  await B.updateTask(y.id, { ...y, actualPct: 30 }, 'u2', nameOf);
  await A.refresh();
  await A.withBase(base).updateTask(x.id, { ...x, name: `${x.name} ZZ` }, 'u1', nameOf);
  const s = await reread(db, TODAY);
  assert.equal(s.tasks.find((t) => t.id === x.id)!.name, `${x.name} ZZ`);
  assert.equal(s.tasks.find((t) => t.id === y.id)!.actualPct, 30);
});

test('C3 창 없는 저장 · 새로 만들기는 표 없이 그대로 (진행률 40 → 50 잇달아 · 일괄 수정 · 순서 바꾸기 · 새 업무)', async () => {
  const { db, A } = await two();
  const t = p2t(snapOf(A));
  await A.setProgress(t.id, 40, '', 'u1');
  await A.setProgress(t.id, 50, '', 'u1');
  await A.bulkUpdate([{ next: { ...p2t(snapOf(A), 1), md: 3 }, summary: '공수 3' }], 'u1');
  await A.moveStd(snapOf(A).stdTasks[1].id, -1);
  await A.addTask({ ...t, id: 'P2|01-97', code: '01-97', name: 'ZZ 새 업무', order: 0 }, 'u1');
  const s = await reread(db, TODAY);
  assert.equal(s.tasks.find((x) => x.id === t.id)!.actualPct, 50);
  assert.ok(s.tasks.some((x) => x.id === 'P2|01-97'));
});

test('C5 메모리 모드는 표를 안 봄 — 옛 표로도 저장 (동작 그대로)', async () => {
  const s = createPmStore(TODAY);
  const t = p2t(await s.snapshot());
  const base = [pmBase('tasks', t.id, t)];
  await s.setProgress(t.id, 60, '', 'u1');
  await s.withBase(base).updateTask(t.id, { ...t, name: `${t.name} ZZ` }, 'u1', nameOf);
  assert.equal((await s.snapshot()).tasks.find((x) => x.id === t.id)!.name, `${t.name} ZZ`);
});
