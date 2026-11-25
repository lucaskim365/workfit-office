import assert from 'node:assert/strict';
import test from 'node:test';
import { createPmStore } from './pm.store';
import { defaultMoneyCfg } from '@/domain/pm/money';
import { kosaH, laborOf, man, manW, noPayC, ovPct, payAmt, payGuess, plOf, plYear, siteChip, siteHead, type PlCtx } from '@/domain/pm/pl';

/**
 * 6-6 사업별 수익 · 월별 · 연간 손익 — 처음 값(신광 C1 · C2 · 효광(AI) C3) + 아래 시나리오를 데모 복사본에 똑같이 넣고
 * 데모 함수(plOf · payGuess · payAmt · ovPct · pMoneySite · pMoneyPL 화면 글자)로 뽑은 값과 비교
 * (C:/Users/jw/ego/pm-step6-6-20261125/d03-demo-pl.mjs → d03-out.json, 오늘 2026-11-25).
 * 시나리오: 신광 선급금 50% 세금계산서 2026-03-10 · C2 '중도금 30%'(날짜 없음) · C2 '잔금' 5,000만 직접 금액 예정 2027-02-15 ·
 * 효광(AI) 선급금 50% 세금계산서 2026-06-05 · 신광 원가 변경 2026-03-20 +300만 · 2026-12-01 −120만 · 간접비 2026-03 1,000만 · 기본 월 간접비 500만.
 */
const TODAY = '2026-11-25';

async function scenario() {
  const s = createPmStore(TODAY);
  let snap = await s.snapshot();
  const sk = snap.projects.find((p) => /신광/.test(p.company))!.id;
  const hk = snap.projects.find((p) => /효광/.test(p.company) && /제조\s*AI/i.test(p.biz))!.id;
  const pay = (k: string, re: RegExp) => snap.pays.find((x) => x.projectId === k && re.test(x.name))!;
  await s.savePay({ ...pay(sk, /선급/), inv: '2026-03-10' });
  await s.savePay({ id: '', projectId: sk, cid: 'C2', name: '중도금 30%', rate: 30, amt: null, due: '', inv: '', paid: '' });
  await s.savePay({ id: '', projectId: sk, cid: 'C2', name: '잔금', rate: 0, amt: 50000000, due: '2027-02-15', inv: '', paid: '' });
  await s.savePay({ ...pay(hk, /선급/), inv: '2026-06-05', paid: '2026-06-30' });
  await s.saveCost({ id: '', projectId: sk, date: '2026-03-20', cat: '장비 · HW 매입', amt: 3000000, vendor: 'A', desc: 'PC' });
  await s.saveCost({ id: '', projectId: sk, date: '2026-12-01', cat: '기타', amt: -1200000, vendor: '', desc: '축소' });
  await s.saveOh('2026-03', 10000000, 'x', 5000000, 'u1', TODAY);
  snap = await s.snapshot();
  const X: PlCtx = { projects: snap.projects, contracts: snap.contracts, pays: snap.pays, costs: snap.costs, oh: snap.oh, cfg: snap.moneyCfg, hours: [], today: TODAY };
  return { s, snap, X, sk, hk };
}

test('사업별 수익: 왼쪽 목록 · 매출 − 원가 = 이익 · 대금 표 (데모 pMoneySite 와 같음)', async () => {
  const { X, sk, hk, snap } = await scenario();
  const P = plOf(X, sk);
  assert.deepEqual({ rev: P.rev, base: P.base, chg: P.chg, est: P.est }, { rev: 614020000, base: 334050000, chg: 1800000, est: { rev: 614020000, buy: 334050000 } });
  // 왼쪽 목록: '신광 6.14억원 45.3%' · '효광(AI) 3.82억원 60.7%' · 나머지 '견적 없음 -'
  const c = siteChip(X, sk);
  assert.equal(manW(c.rv), '6.14억원');
  assert.equal(Math.round(c.pr / c.rv * 1000) / 10, 45.3);
  const ch = siteChip(X, hk);
  assert.equal(`${manW(ch.rv)} ${Math.round(ch.pr / ch.rv * 1000) / 10}%`, '3.82억원 60.7%');
  assert.equal(snap.projects.filter((p) => siteChip(X, p.id).has).length, 2);
  // 위 식: '계약 2건 매출 6.14억원 − 원가 3.36억원 = 이익 45.3% 2.78억원 · 원가 55% 이익 45% · 원가 = 최종 견적 매입 3.34억원 + 변경 180만원'
  const H = siteHead(P);
  assert.deepEqual([H.nSig, manW(H.r), manW(H.c), manW(H.p), Math.round(H.cw), H.est], [2, '6.14억원', '3.36억원', '2.78억원', 55, false]);
  assert.deepEqual([manW(P.base), manW(P.chg)], ['3.34억원', '180만원']);
  const Hh = siteHead(plOf(X, hk));
  assert.deepEqual([Hh.nSig, manW(Hh.r), manW(Hh.c), manW(Hh.p), Math.round(Hh.cw)], [1, '3.82억원', '1.5억원', '2.32억원', 39]);
  // 대금 표 (만원): 19,641 · 19,641 · 6,636 · 5,000 / 대금 단계 없는 계약 없음
  assert.deepEqual(X.pays.filter((x) => x.projectId === sk).map((x) => `${x.name} ${man(payAmt(X, x))}`), ['선급금 50% 19,641', '잔금 50% 19,641', '중도금 30% 6,636', '잔금 5,000']);
  assert.equal(noPayC(X, sk).length, 0);
  // 예정일 추정: 선급 → 협약 시작, 잔금 → 협약 종료, 중도 → 가운데 (7/1 ~ 3/31 → 11/15)
  assert.deepEqual(X.pays.filter((x) => x.projectId === sk).map((x) => payGuess(X, x)), [{ d: '2026-07-01', est: true }, { d: '2027-03-31', est: true }, { d: '2026-11-15', est: true }, { d: '2027-02-15', est: false }]);
  // 통합 사업 현황 '견적 이익률': 신광 45.6% (견적 매출 61,402만 · 이익 27,997만) · 효광(AI) 60.7% (38,196만 · 23,191만)
  const o = ovPct(X, sk)!, oh = ovPct(X, hk)!;
  assert.deepEqual([man(o.rev), man(o.prof), Math.round(o.pct! * 1000) / 10], ['61,402', '27,997', 45.6]);
  assert.deepEqual([man(oh.rev), man(oh.prof), Math.round(oh.pct! * 1000) / 10], ['38,196', '23,191', 60.7]);
  assert.equal(ovPct(X, 'P3'), null);
});

test('재원 탭: 신광 확정 19,440 · 효광(AI) 계획서 19,400 (데모 fundOf 화면과 같음)', async () => {
  const { s, sk, hk } = await scenario();
  const F = s.fundOf(sk, TODAY);
  assert.deepEqual([F.build, F.man, F.cloud, F.total, F.self].map(man), ['39,282', '0', '540', '39,822', '19,842']);
  assert.deepEqual(F.rows.map((r) => [r.name, man(r.calc), man(r.use), r.fix != null, r.fromPlan]), [['정부', '19,911', '19,440', true, false]]);
  const Fh = s.fundOf(hk, TODAY);
  assert.deepEqual([Fh.build, Fh.man, Fh.cloud, Fh.total, Fh.self].map(man), ['38,196', '1,800', '0', '39,996', '18,796']);
  assert.deepEqual(Fh.rows.map((r) => [man(r.calc), man(r.use), r.fromPlan]), [['19,998', '19,400', true]]);
});

test('월별 · 연간 손익 2026 · 2027 (데모 pMoneyPL 화면과 같음)', async () => {
  const { X } = await scenario();
  const P = plYear(X, '2026');
  const row = (r: { rev: number; plan: number; buy: number; lab: number; p: number; oh: number; net: number }) => [r.rev, r.plan, r.buy, r.lab, r.p, r.oh, r.net].map((v) => (v ? man(v) : '-')).join(' | ');
  assert.deepEqual(P.R.map((r) => `${+r.m.slice(5)}월 | ${row(r)}`), [
    '1월 | - | - | - | - | - | 500 | -500', '2월 | - | - | - | - | - | 500 | -500',
    '3월 | 19,641 | - | 13,994 | - | 5,648 | 1,000 | 4,648', '4월 | - | - | - | - | - | 500 | -500', '5월 | - | - | - | - | - | 500 | -500',
    '6월 | 19,098 | - | 7,503 | - | 11,596 | 500 | 11,096', '7월 | - | - | - | - | - | 500 | -500', '8월 | - | - | - | - | - | 500 | -500',
    '9월 | - | - | - | - | - | 500 | -500', '10월 | - | - | - | - | - | 500 | -500', '11월 | - | 6,636 | - | - | - | 500 | -500', '12월 | - | - | -120 | - | 120 | - | 120',
  ]);
  assert.equal(`합계 | ${row(P.T)}`, '합계 | 38,739 | 6,636 | 21,376 | - | 17,363 | 6,000 | 11,363');
  // 카드: 매출 3.87억원 · 예정 6,636만원 · 사업 이익 1.74억원 · 매입 2.14억원 · 간접비 6,000만원 · 순수익 1.14억원 · 이번 달 −500만원 · 29.3%
  assert.deepEqual([manW(P.T.rev), manW(P.T.plan), manW(P.T.p), manW(P.T.buy), manW(P.T.oh), manW(P.T.net), manW(P.cur!.net), Math.round(P.T.net / P.T.rev * 1000) / 10],
    ['3.87억원', '6,636만원', '1.74억원', '2.14억원', '6,000만원', '1.14억원', '−500만원', 29.3]);
  assert.deepEqual(P.ys, ['2025', '2026', '2027']);
  // 사업별: 신광 19,641 · 13,874 · 5,768 · 29.4% / 효광(AI) 19,098 · 7,503 · 11,596 · 60.7%
  assert.deepEqual(P.bySite.map((x) => `${x.p.company} | ${man(x.rev)} | ${man(x.buy)} | ${man(x.p_)} | ${Math.round(x.p_ / x.rev * 1000) / 10}%`), ['신광테크 | 19,641 | 13,874 | 5,768 | 29.4%', '㈜효광 | 19,098 | 7,503 | 11,596 | 60.7%']);
  // 앞으로 12개월: 11월 추정 6,636 · 27년 2월 예정 5,000 · 3월 추정 19,641 · 5월 추정 19,098
  const F = P.F.filter((f) => f.fix + f.est).map((f) => `${f.m} ${man(f.fix)} ${man(f.est)} ${f.L.map((o) => o.x.name + (o.est ? '(추정)' : '')).join('·')}`);
  assert.deepEqual(F, ['2026-11 0 6,636 중도금 30%(추정)', '2027-02 5,000 0 잔금', '2027-03 0 19,641 잔금 50%(추정)', '2027-05 0 19,098 잔금 50%(추정)']);
  assert.deepEqual([P.late.length, P.nod.length], [0, 0]);
  const Q = plYear(X, '2027');
  assert.equal(`합계 | ${row(Q.T)}`, '합계 | - | 43,739 | - | - | - | - | -');
  assert.equal(Q.bySite.length, 0);
});

test('인건비 (반영 켜면): 업무계획 시간 × KOSA 월 단가 ÷ 209h — 손계산', () => {
  const cfg = { ...defaultMoneyCfg(), laborOn: true };
  const X: PlCtx = { projects: [], contracts: [], pays: [], costs: [], oh: [], cfg, today: TODAY,
    hours: [{ who: 'u1', d: '2026-11-03', h: 8, projectId: 'P2', txt: '' }, { who: 'u2', d: '2026-11-04', h: 3.5, projectId: 'P2', txt: '' }, { who: 'u1', d: '2026-11-04', h: 2, projectId: '', txt: '' }, { who: 'u1', d: '2026-10-30', h: 1, projectId: 'P2', txt: '' }] };
  assert.equal(kosaH(cfg), 7754124 / 209);
  const L = laborOf(X, 'P2', '2026-11-01', '2026-11-30');
  assert.deepEqual(L.per, { u1: 8, u2: 3.5 });
  assert.equal(Math.round(L.amt), 426662); // 11.5h × 37,101.07원
  // 월별 (만원): 사업 없는 시간(2h)은 빠짐, 11월 43 · 10월 4 (1h = 37,101원)
  const P = plYear(X, '2026');
  assert.deepEqual([man(P.R[10].lab), man(P.R[9].lab)], ['43', '4']);
  assert.equal(kosaH(defaultMoneyCfg()), 0);
});

test('저장: 대금 · 원가 변경 추가 · 수정 · 삭제 · 간접비 비우면 지움 · 재원 수정 · 사업 지우면 원가 변경도', async () => {
  const s = createPmStore(TODAY);
  const p = await s.savePay({ id: '', projectId: 'P2', cid: 'C1', name: '중도금 20%', rate: 20, amt: null, due: '', inv: '', paid: '' });
  assert.match(p.id, /^D/);
  await s.savePay({ ...p, inv: '2026-11-20' });
  let snap = await s.snapshot();
  assert.equal(snap.pays.find((x) => x.id === p.id)!.inv, '2026-11-20');
  await assert.rejects(s.savePay({ ...p, id: '', cid: 'C3' }), /계약을 찾을 수 없습니다/);
  await s.removePay(p.id);
  const c = await s.saveCost({ id: '', projectId: 'P2', date: '2026-11-01', cat: '기타', amt: 1000000, vendor: '', desc: '' });
  await s.saveCost({ ...c, amt: -500000 });
  snap = await s.snapshot();
  assert.deepEqual([snap.pays.some((x) => x.id === p.id), snap.costs.map((x) => x.amt)], [false, [-500000]]);
  await s.saveOh('2026-10', 3000000, '임대료', null, 'u1', TODAY);
  await s.saveOh('2026-10', null, '', 2000000, 'u1', TODAY);
  snap = await s.snapshot();
  assert.deepEqual([snap.oh.length, snap.moneyCfg.ohDefault], [0, 2000000]);
  await assert.rejects(s.saveOh('2026-1', null, '', null, 'u1', TODAY), /달은/);
  const f = snap.funds.find((x) => x.id === 'P2')!;
  await s.saveFund({ ...f, rule: '', man: 1000000, fix: {} });
  snap = await s.snapshot();
  const nf = snap.funds.find((x) => x.id === 'P2')!;
  assert.deepEqual([nf.ruleSet, nf.man, nf.fix], [true, 1000000, {}]);
  // 사람이 '선택 안 함'으로 고르면 자동 기준도 안 씀 → 비율 계산 없이 계획서 정부지원금만 (데모 fundOf 그대로)
  assert.deepEqual(s.fundOf('P2', TODAY).rows.map((r) => [r.calc, r.fromPlan]), [[null, true]]);
  await s.removeProject('P2', 'u1', TODAY);
  snap = await s.snapshot();
  assert.equal(snap.costs.length, 0);
});
