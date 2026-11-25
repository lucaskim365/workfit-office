import assert from 'node:assert/strict';
import test from 'node:test';
import { seedItems, seedPlans, seedProjects } from '@/data/pm/seed';
import { defaultMoneyCfg, seedFundRules } from './money';
import {
  cSum, fundOf, lineToItem, paysFromTerms, pickList, pickToLine, qFundRows, qHist, qIt, qLines, qNewRows, qOv, quoteCheck, quoteDraft, seedMoney, type FundCtx, type PmContract,
} from './quote';
import { fillMyungsung } from './quoteDemo';

/**
 * 6-5 견적 작성 — 기대값은 데모 복사본(포트 8125)에서 같은 견적을 열고 데모 함수 qLines · qOv · fundOf · qFundRows 를 직접 불러 뽑은 것 (11/25).
 * 명성ENG 테스트 값(qDemo)을 한일(견적 · 계획서 없음) · 신광(다른 정부지원 계약 있음) · 효광(계획서 있음)에 넣어 본 결과와 처음 값 계약 3건.
 */
const TODAY = '2026-11-25';
const projects = seedProjects();
const seed = seedMoney(projects);
const ctx = (contracts: PmContract[] = seed.contracts): FundCtx => ({ projects, plans: seedPlans(), rules: seedFundRules(), cfg: defaultMoneyCfg(), contracts, funds: seed.funds, today: TODAY });
const rowsOf = (c: FundCtx, E: ReturnType<typeof quoteDraft>) => qFundRows(fundOf(c, E.projectId, qOv(c, E)), c.cfg).map((r) => [r.l, r.v, r.n]);
const open = (projectId: string, cid = '') => {
  const c = ctx();
  return quoteDraft(cid ? c.contracts.find((x) => x.id === cid)! : null, projectId, c.funds.find((f) => f.id === projectId), c.cfg, TODAY);
};
const myung = (projectId: string) => fillMyungsung(open(projectId), 'F2');

const MYUNG_LINES = [
  { cat: 'MES개발비', rev: 132000000, buy: 0 }, { cat: '전처리', rev: 5000000, buy: 0 }, { cat: '경비', rev: 15000000, buy: 0 }, { cat: '설비', rev: 160000000, buy: 160000000 },
  { cat: '디바이스', rev: 19971000, buy: 16401000 }, { cat: 'PLC', rev: 28450000, buy: 22000000 }, { cat: '네트워크', rev: 6200000, buy: 4900000 }, { cat: '기타(임치·정산·교육)', rev: 2360000, buy: 2360000 },
];
const fundRows = (gov: [number, string], self: number) => [
  ['① 사업금액', 399581000, '② + ④ + ⑤'], ['② 구축금액', 368981000, '워크핏㈜ 견적금액'], ['③ 정부지원금', gov[0], `${gov[1]} · 2026 · 전국 · 부처협업형`],
  ['④ 인력지원금(현물)', 18000000, '도입기업 투입인력 현물인건비'], ['⑤ 클라우드 지원금(현물)', 12600000, '350,000원*36개월'], ['⑥ 지방비 지원금', 0, '① X 지원비율 지자체 예산에 따라 변동 가능'],
  ['⑦ 도입기업 실제 자부담금', self, '① - (③ + ④ + ⑤ + ⑥)'], ['⑧ 착수금', self, 'RCMS 계좌에 송금'],
];

test('명성ENG 테스트 값 = 데모: 표지 요약 · 합계 368,981,000 · 매입 205,661,000', () => {
  const E = myung('P4');
  assert.equal(E.q.items.length, 15);
  assert.deepEqual(qLines(E.q).filter((l) => l.rev || l.buy), MYUNG_LINES);
  const t = cSum({ lines: qLines(E.q) });
  assert.deepEqual(t, { rev: 368981000, buy: 205661000 });
});

test('사업비 현황 ①~⑧ = 데모 (한일 · 신광 · 효광에 명성 값)', () => {
  const c = ctx();
  // 한일: 계약 · 계획서 없음 → 지원 기준 계산 (원본 엑셀과 같음)
  assert.deepEqual(rowsOf(c, myung('P4')), fundRows([199790500, '① X 50%(최대 2억원)'], 169190500));
  assert.equal(qOv(c, myung('P4')).solo, true);
  // 신광: 다른 정부지원 계약(C1)이 있어 이 견적 금액만 — 확정 금액 · 계획서 안 씀
  assert.equal(qOv(c, myung('P2')).solo, false);
  assert.deepEqual(rowsOf(c, myung('P2')), fundRows([199790500, '① X 50%(최대 2억원)'], 169190500));
  // 효광: 계획서 4.1 총괄의 정부지원금이 확정 금액
  assert.deepEqual(rowsOf(c, myung('P3')), fundRows([194400000, '사업계획서 확정 금액'], 174581000));
});

test('처음 값 계약 열기 = 데모: 신광 C1(품목 없음 → 항목마다 한 줄) · C2(자체) · 효광(AI) C3', () => {
  const c = ctx();
  const c1 = open('P2', 'C1');
  assert.equal(c1.conv, true);
  assert.equal(c1.q.items.length, 10);
  assert.deepEqual(c1.q.items.map((x) => [x.sec, x.name, x.price, x.cost]).slice(0, 4), [['sw', 'MES개발비', 175000000, 0], ['sw', '전처리', 5000000, 2310000], ['sw', '경비', 15000000, 0], ['hw', 'PLC제어', 0, 12000000]]);
  assert.deepEqual(rowsOf(c, c1).map((r) => r[1]), [398220000, 392820000, 194400000, 0, 5400000, 0, 198420000, 198420000]);
  assert.equal(rowsOf(c, c1)[2][2], '확정 금액 · 2026 · 전국 · 부처협업형');
  assert.equal(rowsOf(c, c1)[4][2], '150,000원*36개월');
  const c2 = open('P2', 'C2');
  assert.equal(c2.kind, '자체');
  assert.deepEqual(rowsOf(c, c2).map((r) => r[1]), [0, 0, 0, 0, 0, 0, 0, 0]);
  const c3 = open('P7', 'C3');
  assert.equal(c3.conv, false);
  assert.deepEqual(cSum(seed.contracts.find((x) => x.id === 'C3')!), { rev: 381960000, buy: 150050000 });
  assert.deepEqual(rowsOf(c, c3).map((r) => r[1]), [399960000, 381960000, 194000000, 18000000, 0, 0, 187960000, 187960000]);
  assert.equal(rowsOf(c, c3)[2][2], '사업계획서 확정 금액 · 2026 · 전국 · 제조AI특화');
  assert.equal(seed.pays.length, 4);
});

test('품목에서 고르기 · 직접 쓴 줄 등록 · 지난 견적 쌓기 · 지불조건 → 대금 단계', () => {
  const items = seedItems();
  const P = pickList(items, { sec: 'hw', q: '', all: false, freq: false, kind: '' });
  assert.equal(P.all, 84);
  assert.equal(P.rows.length, 84);
  const kio = pickList(items, { sec: 'hw', q: '키오스크', all: false, freq: false, kind: '' });
  const it = kio.rows[0];
  const line = pickToLine(it, 'hw', 3);
  assert.equal(line.pid, it.id);
  assert.equal(line.qty, 3);
  // 목록에 없는 직접 쓴 줄 (MES 개발 줄 · 이름 없는 줄 · 이미 있는 이름은 뺌)
  const q = { items: [line, qIt('hw', { name: '새 장비\n(검수용)', price: 1000, cost: 700 }), qIt('sw', { name: 'MES', price: 5 }), qIt('hw', { name: ' 바코드 스캐너 ', price: 1 }), qIt('hw', { name: '', price: 3 })] };
  assert.deepEqual(qNewRows(items, q).map((x) => x.name), ['새 장비\n(검수용)', ' 바코드 스캐너 '].filter((n) => !items.some((c) => c.name.replace(/\s/g, '') === n.replace(/\s/g, ''))));
  const ni = lineToItem(q.items[1], 'PX', '한일', '2026-11-25');
  assert.equal(ni.name, '새 장비 (검수용)');
  assert.deepEqual(ni.hist, [{ src: '한일', date: '2026-11-25', price: 1000, cost: 700, qty: 1, cid: '' }]);
  // 저장한 견적이 가장 최근이면 기본 단가도 이 값
  const c: PmContract = { id: 'CX', projectId: 'P4', name: 'x', kind: '자체', status: '견적', conf: true, note: '', q: { ...myung('P4').q, date: '2026-12-01', items: [{ ...line, price: 999000, cost: 500000 }] }, lines: [] };
  const before = it.hist.length;
  qHist(items, c, '한일', TODAY);
  const after = items.find((x) => x.id === it.id)!;
  assert.equal(after.hist.length, before + 1);
  assert.deepEqual([after.hist[0].cid, after.price, after.cost], ['CX', 999000, 500000]);
  qHist(items, c, '한일', TODAY);
  assert.equal(after.hist.length, before + 1, '같은 견적을 다시 저장하면 지난 견적 줄은 하나');
  assert.deepEqual(paysFromTerms('현금결제 조건 / 선급금 50%, 잔금 50%'), [{ name: '선급금 50%', rate: 50 }, { name: '잔금 50%', rate: 50 }]);
  assert.deepEqual(paysFromTerms('현금결제 조건'), []);
  assert.deepEqual(quoteCheck({ ...open('P4'), name: ' ' }), ['계약 이름을 넣어 주세요', 'name']);
  assert.deepEqual(quoteCheck({ ...open('P4'), name: 'a' }), ['금액이 있는 품목이 하나도 없습니다', 'items']);
});
