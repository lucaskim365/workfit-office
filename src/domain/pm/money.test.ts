import assert from 'node:assert/strict';
import test from 'node:test';
import { seedItems } from '@/data/pm/seed';
import {
  ciKind, ciMargin, ciRange, ciUse, descHead, itemCheck, itemDraft, itemFromDraft, itemList, pctText, ruleCheck, ruleDraft, ruleFromDraft, seedFundRules, sortRules, wonText,
} from './money';

/**
 * 6-4 지원 기준 · 품목 — 값은 데모 함수(CI_KINDS · ciKindSort · ciMargin · ciRange · ciList 거르기, pMoneyRules 순서)를
 * 데모 내장 QT_CAT_SEED 89개 · FUND_SEED 13줄에 그대로 돌려 뽑은 것 (11/25, 데모 4386~5089).
 */
const F0 = { sec: '', kind: '', cat: '', q: '' } as const;

test('품목 89개 = 데모 QT_CAT_SEED: 구분 · 종류별 개수 · 확인 필요 · 그대로 · 현장마다 다름', () => {
  const L = seedItems();
  assert.equal(L.length, 89);
  const by = (f: (x: (typeof L)[number]) => string) => L.reduce<Record<string, number>>((a, x) => ({ ...a, [f(x)]: (a[f(x)] ?? 0) + 1 }), {});
  assert.deepEqual(by((x) => x.sec), { sw: 2, hw: 84, etc: 3 });
  assert.deepEqual(by(ciKind), { '프로그램·용역': 10, '프린터·스캐너': 7, '단말·키오스크': 8, '현황판·디스플레이': 8, 'PC·서버': 7, 'PLC·제어·설비': 12, '네트워크·공사': 20, '교육·임치·정산': 3, '센서·계측': 9, '카메라·CCTV': 5 });
  assert.equal(L.filter((x) => !x.pass && x.cost == null).length, 66, "매입단가 '확인 필요'");
  assert.equal(L.filter((x) => x.pass).length, 3);
  assert.equal(L.filter((x) => x.vary).length, 21);
});

test('품목 목록 순서 (ciList) = 데모: 소프트웨어 → 하드웨어 종류 순 → 자주 쓰인 순', () => {
  const ids = itemList(seedItems(), F0).map((x) => x.id);
  assert.deepEqual(ids, ['P2', 'P1', 'P15', 'P4', 'P14', 'P25', 'P21', 'P24', 'P22', 'P23', 'P16', 'P68', 'P49', 'P8', 'P86', 'P85', 'P89', 'P5', 'P3', 'P20', 'P28', 'P29', 'P30', 'P84', 'P6', 'P17', 'P82', 'P83', 'P80', 'P45', 'P7', 'P76', 'P18', 'P43', 'P44', 'P74', 'P55', 'P64', 'P66', 'P65', 'P75', 'P40', 'P33', 'P34', 'P32', 'P73', 'P9', 'P19', 'P47', 'P67', 'P48', 'P59', 'P60', 'P61', 'P53', 'P46', 'P87', 'P88', 'P10', 'P37', 'P36', 'P39', 'P57', 'P56', 'P69', 'P70', 'P42', 'P41', 'P62', 'P26', 'P54', 'P35', 'P81', 'P78', 'P77', 'P51', 'P50', 'P38', 'P58', 'P79', 'P31', 'P52', 'P63', 'P27', 'P71', 'P72', 'P12', 'P11', 'P13']);
  // 앞 6줄: 종류 · 쓰인 견적 수 · 이익률 · 지난 단가 범위
  const show = (x: ReturnType<typeof seedItems>[number]) => [x.id, x.name, ciKind(x), ciUse(x), pctText(ciMargin(x)), ciRange(x)].join('|');
  assert.deepEqual(itemList(seedItems(), F0).slice(0, 6).map(show), [
    'P2|스마트팩토리 진행경비|프로그램·용역|5|-|',
    'P1|미들웨어 전처리|프로그램·용역|4|-|',
    'P15|키오스크|단말·키오스크|2|0%|2,000,000 ~ 2,400,000',
    'P4|키오스크 Panel PC|단말·키오스크|2|34%|2,000,000 ~ 2,500,000',
    'P14|PDA|단말·키오스크|1|58.3%|',
    'P25|키오스크 음성 안내 장치|단말·키오스크|1|-|',
  ]);
  assert.equal(descHead('■ 설비데이터 전처리(미들웨어)\n ▪ 설비데이터 Read 기준'), '설비데이터 전처리(미들웨어)');
});

test('품목 거르기: 검색(이름 · 사양 · 견적 이름, 띄어쓰기 · 대소문자 무시) · 표지 분류 · 구분 · 종류', () => {
  const L = seedItems();
  assert.equal(itemList(L, { ...F0, q: '키오스크' }).length, 15);
  assert.equal(itemList(L, { ...F0, q: '명성 ENG' }).length, 13);
  assert.equal(itemList(L, { ...F0, q: 'PC' }).length, 20);
  assert.equal(itemList(L, { ...F0, cat: '네트워크' }).length, 20);
  assert.equal(itemList(L, { ...F0, sec: 'etc' }).length, 3);
  assert.equal(itemList(L, { ...F0, kind: '카메라·CCTV' }).length, 5);
});

test('품목 창: 고친 값 → 품목 (종류를 고르면 그 값, 매입 비우면 확인 필요, 지난 견적 · 묶음은 그대로)', () => {
  const p4 = seedItems().find((x) => x.id === 'P4')!;
  const v = itemDraft(p4);
  assert.equal(v.kind, '단말·키오스크');
  assert.deepEqual(itemCheck({ ...v, name: ' ' }), ['품목 이름을 넣어 주세요', 'name']);
  assert.deepEqual(itemCheck({ ...v, price: '' }), ['공급단가를 0 이상 숫자로 넣어 주세요', 'price']);
  const x = itemFromDraft({ ...v, kind: 'PC·서버', cost: '', price: '2600000' }, p4, p4.id);
  assert.deepEqual([x.kind, ciKind(x), x.cost, x.price, x.hist.length, x.grp], ['PC·서버', 'PC·서버', null, 2600000, p4.hist.length, p4.grp]);
  assert.equal(pctText(ciMargin(x)), '-');
  const n = itemFromDraft({ ...itemDraft(null), name: '산업용 태블릿', price: '1500000', cost: '1000000' }, null, 'Pnew');
  assert.deepEqual([n.sec, n.cat, n.unit, n.hist.length, pctText(ciMargin(n))], ['hw', '디바이스', 'set', 0, '33.3%']);
});

test('지원 기준 13줄 = 데모 FUND_SEED: 표 순서(최근 연도 → 전국 → 지역 이름) · 금액은 원 · 칸 글자', () => {
  const rs = seedFundRules();
  assert.equal(rs.length, 13);
  assert.deepEqual(sortRules(rs).map((r) => r.id), ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F11', 'F7', 'F8', 'F9', 'F13', 'F10', 'F12']);
  const f = (id: string) => rs.find((r) => r.id === id)!;
  assert.deepEqual(f('F2').gov, { rate: 50, cap: 200_000_000 });
  assert.equal(wonText(f('F2').gov!.cap), '2억원');
  assert.equal(wonText(f('F4').gov!.cap), '6억원');
  assert.equal(wonText(f('F5').gov!.cap), '1.2억원');
  assert.equal(wonText(f('F9').do!.cap), '3,600만원');
  assert.deepEqual(f('F6').do, { rate: null, cap: null }, "칸은 있고 비율 모름 → '비율?'");
  assert.equal(f('F6').si, null);
  assert.equal(wonText(f('F8').capLocal), '4억원');
  assert.deepEqual(f('F10').etc, { name: '대기업(삼성)', rate: 30, cap: null });
  assert.equal(rs.filter((r) => r.conf).length, 8);
});

test('지원 기준 창: 만원 입력 → 원, 비율 · 상한이 둘 다 비면 그 재원 없음, 기타는 이름이 있어야', () => {
  const v = ruleDraft(seedFundRules().find((r) => r.id === 'F10')!, 2026);
  assert.deepEqual([v.govR, v.govC, v.siC, v.etcN, v.etcR, v.etcC], ['30', '15000', '2000', '대기업(삼성)', '30', '']);
  const r = ruleFromDraft({ ...v, doR: '10', doC: '', siR: '', siC: '', etcN: '', capLocal: '4000' }, 'F10');
  assert.deepEqual([r.do, r.si, r.etc, r.capLocal, r.gov?.cap], [{ rate: 10, cap: null }, null, null, 40_000_000, 150_000_000]);
  const n = ruleDraft(null, 2026);
  assert.deepEqual(ruleCheck(n), ['지역을 넣어 주세요', 'region']);
  assert.deepEqual(ruleCheck({ ...n, region: '경남', biz: '경남형', govR: '120' }), ['비율은 0~100 사이로 넣어 주세요', 'govR']);
  assert.equal(ruleCheck({ ...n, region: '경남', biz: '경남형' }), null);
});
