import assert from 'node:assert/strict';
import test from 'node:test';
import { aiEval, fmtPct, kImp, kpiDefs, kpiEval, kpiScore, type PmKpiMeas } from './kpi';
import { bellGroup, type PmAlert } from './alerts';

/** 성과지표 계산 — 신광 계획서 지표(제조리드타임 27 → 24.5일, 감소가 개선, 가중 0.5)를 본뜬 작은 데이터 */
const plan = { kpis: [
  { f: 'D', name: '제조리드타임', unit: '일', base: 27, target: 24.5, w: 0.5, dir: 'down' as const },
  { f: 'P', name: '시간당생산량', unit: 'EA/HR', base: 100, target: 120, w: 0.5, dir: 'up' as const },
] };
const M = (kid: string, date: string, val: number): PmKpiMeas => ({ id: `${kid}${date}`, projectId: 'P2', kid, date, val, memo: '', who: 'me' });

test('개선율 · 달성률 · 목표 달성 (kImp · kpiEval)', () => {
  const ds = kpiDefs(plan, []);
  assert.deepEqual(ds.map((x) => `${x.id}:${x.src}`), ['P0:계획서', 'P1:계획서']);
  assert.equal(fmtPct(kImp(ds[0], 24.5)), '+9.3%', '감소 지표 목표 개선율 9.3%');
  const e = kpiEval([M('P0', '2027-03-01', 26), M('P0', '2027-05-01', 25)], ds[0]);
  assert.equal(e.last!.val, 25, '최근 실측 = 날짜가 가장 늦은 것');
  assert.equal(Math.round(e.ach!), 80);
  assert.equal(e.ok, false);
  assert.equal(kpiEval([M('P0', '2027-05-01', 24)], ds[0]).ok, true);
});

test('가중 달성도: 실측 있는 지표만, 달성률 0~100 으로 자름 (kpiScore)', () => {
  const ds = kpiDefs(plan, [{ id: 'KD1', projectId: 'P2', f: 'Q', name: '불량률', unit: '%', dir: 'down', base: 2, target: 1, w: 0, period: '', method: '' }]);
  assert.equal(ds[2].src, '직접 등록');
  const sc = kpiScore(ds, [M('P0', '2027-05-01', 24), M('P1', '2027-05-01', 110)])!;
  // P0 = 120% → 100 · P1 = 50% · 가중치 합 1.0 (직접 등록 0) → (0.5×100 + 0.5×50) / 1 = 75
  assert.deepEqual([sc.n, sc.total, Math.round(sc.score)], [2, 3, 75]);
  assert.equal(kpiScore([], []), null);
});

test('AI 성능 판정 (aiEval)', () => {
  assert.equal(aiEval({ n: 'MAPE', unit: '%', t: 10, op: 'le', tt: '10% 이하', m: '' }, null), null);
  assert.equal(aiEval({ n: 'MAPE', unit: '%', t: 10, op: 'le', tt: '', m: '' }, { id: '', projectId: '', i: 0, date: '', val: 9, ok: '', memo: '', who: '' }), true);
  assert.equal(aiEval({ n: 'Recall', unit: '%', t: 75, op: 'ge', tt: '', m: '' }, { id: '', projectId: '', i: 0, date: '', val: 70, ok: '', memo: '', who: '' }), false);
  assert.equal(aiEval({ n: '확인', unit: '', t: 0, op: 'chk', tt: '', m: '' }, { id: '', projectId: '', i: 0, date: '', val: null, ok: '충족', memo: '', who: '' }), true);
});

test('알림 묶기: 같은 종류 2곳 이상이면 한 줄 · 진행률 갱신 두 줄은 합침 (bellGroup)', () => {
  const L: PmAlert[] = [
    { lv: 'warn', txt: 'a', grp: 'buyer', gk: '신광', gn: 2 },
    { lv: 'bad', txt: 'b', grp: 'buyer', gk: '효광', gn: 1 },
    { lv: 'warn', txt: 'c', grp: 'ms', gk: '꽃샘', gn: 1 },
    { lv: 'warn', txt: '진행률 갱신 3건', upd: true },
    { lv: 'warn', txt: 'w1', grp: 'wc', gk: '신광', gn: 4 },
  ];
  const r = bellGroup(L).map((a) => `${a.lv}|${a.txt}`);
  assert.deepEqual(r, [
    'bad|도입기업 챙길 일 2곳 — 신광 2 · 효광 1 — 통합 사업 현황 표의 도입기업 칸',
    'warn|c',
    'warn|진행률 갱신 3건 · 내가 PM인 사업 남은 갱신 신광 4',
  ]);
});
