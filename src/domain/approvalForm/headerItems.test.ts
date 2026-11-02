import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_LETTERHEAD, headerShown, letterheadEntries, letterheadLines, letterheadSiteOptions, sealTextOf, titleFieldOf, withSealTexts } from './headerItems';
import { docNoOf, DOC_NO_VALUE_KEY } from '../approvalDoc/docNo';

test('머리 항목 — 목록에 없는 서식(기존 서식)은 모두 보인다', () => {
  assert.equal(headerShown({}, 'docNo'), true);
  assert.equal(headerShown({ hiddenHeaderItems: null }, 'drafter'), true);
  assert.equal(headerShown({ hiddenHeaderItems: ['docNo'] }, 'docNo'), false);
  assert.equal(headerShown({ hiddenHeaderItems: ['docNo'] }, 'drafter'), true);
});

test('문서제목 칸 찾기', () => {
  assert.equal(titleFieldOf([{ type: '텍스트', key: 'a' }])?.key, undefined);
  assert.equal(titleFieldOf([{ type: '텍스트', key: 'a' }, { type: '문서제목', key: 't' }])?.key, 't');
});

const SITES = [
  { name: '본사', addr: '서울 강남구 1', active: true },
  { name: '부설연구소', addr: '대전 유성구 연구로 1', active: true },
  { name: '물류센터', addr: '경기 이천시 2', active: true },
  { name: '옛 공장', addr: '인천 3', active: false },
  { name: '주소 없음', addr: '', active: true },
];

test('회사 정보 머리글 — 고른 항목만, 빈 값은 뺀다, 사업장 주소는 사업장 현황에서', () => {
  const lines = letterheadLines(
    { items: ['address', 'labAddress', 'fax'], labAddress: '예전에 적은 주소' },
    { address: '서울 강남구 1', fax: '', tel: '02-000-0000' },
    SITES,
  );
  // 회사 주소와 같은 본사, 사용 안 함·주소 없는 사업장은 빠지고, 서식에 예전에 적은 연구소 주소는 쓰지 않는다
  assert.deepEqual(lines.map((l) => [l.label, l.value]), [
    ['회사 주소', '서울 강남구 1'],
    ['부설연구소', '대전 유성구 연구로 1'],
    ['물류센터', '경기 이천시 2'],
  ]);
  assert.equal(letterheadLines(DEFAULT_LETTERHEAD, { tel: '02-1' }, []).length, 1);
});

test('회사 정보 머리글 — 고른 사업장만', () => {
  const lines = letterheadLines({ items: ['labAddress'], labAddress: '', siteNames: ['부설연구소'] }, {}, SITES);
  assert.deepEqual(lines.map((l) => l.label), ['부설연구소']);
  // 고른 사업장이 없으면 사업장 줄도 없다
  assert.equal(letterheadLines({ items: ['labAddress'], labAddress: '', siteNames: [] }, {}, SITES).length, 0);
});

test('회사 정보 머리글 — 사업장 선택지는 사용 중이고 주소가 있는 사업장', () => {
  assert.deepEqual(letterheadSiteOptions(SITES).map((s) => s.name), ['본사', '부설연구소', '물류센터']);
});

test('보이는 문서번호 — 문서번호로 쓰는 자동번호가 있으면 그것, 없으면 AP 번호', () => {
  assert.equal(docNoOf({ docNo: 'AP-261101-001', fieldValues: {} }), 'AP-261101-001');
  assert.equal(docNoOf({ docNo: 'AP-261101-001', fieldValues: { [DOC_NO_VALUE_KEY]: '20261101 - 01호' } }), '20261101 - 01호');
});

test('직인 문구 — 문서에 고친 문구가 있으면 그것, 없거나 비면 서식의 문구', () => {
  const field = { key: 'seal', label: '워크핏 주식회사 AX지능화본부장' };
  assert.equal(sealTextOf(field, {}), '워크핏 주식회사 AX지능화본부장');
  assert.equal(sealTextOf(field, { seal: '  ' }), '워크핏 주식회사 AX지능화본부장');
  assert.equal(sealTextOf(field, { seal: '워크핏 주식회사 대표이사' }), '워크핏 주식회사 대표이사');
});

test('직인 문구 고정 — 상신할 때 그 시점 문구를 값에 남겨, 나중에 서식 문구가 바뀌어도 문서는 그대로', () => {
  const fields = [{ key: 'seal', label: '워크핏 주식회사 AX지능화본부장', type: '직인' }, { key: 'to', label: '수신', type: '텍스트' }];
  assert.deepEqual(withSealTexts(fields, { to: '무한콘트롤' }), { to: '무한콘트롤', seal: '워크핏 주식회사 AX지능화본부장' });
  assert.deepEqual(withSealTexts(fields, { seal: '대표이사' }), { seal: '대표이사' });
  const values = { to: 'x' };
  assert.equal(withSealTexts([{ key: 'to', label: '수신', type: '텍스트' }], values), values);
});

const COMPANY = { address: '서울 동작구 7층', tel: '02-467', fax: '02-468', homepage: 'www.workfit.kr', email: 'a@workfit.kr' };
const SITES2 = [{ name: '연구소', addr: '서울 동작구 9층', active: true }];

test('회사 정보 머리글 — 항목 이름은 서식에서 바꾼 이름, 비우면 기본 이름', () => {
  const lines = letterheadLines(
    { ...DEFAULT_LETTERHEAD, labels: { address: 'AI Factory base Camp', 'site:연구소': 'AI Factory 기업부설 연구소', tel: '  ' } },
    COMPANY,
    SITES2,
  );
  assert.deepEqual(lines.slice(0, 3).map((l) => l.label), ['AI Factory base Camp', 'AI Factory 기업부설 연구소', '대표전화']);
});

test('회사 정보 머리글 — 고른 순서대로, 순서 목록에 없는 줄은 기본 순서로 뒤에', () => {
  const lines = letterheadLines({ ...DEFAULT_LETTERHEAD, order: ['email', 'site:연구소', 'address'] }, COMPANY, SITES2);
  assert.deepEqual(lines.map((l) => l.key), ['email', 'site:연구소', 'address', 'tel', 'fax', 'homepage']);
});

test('회사 정보 머리글 — 한 줄 전체로 고른 줄 표시', () => {
  const lines = letterheadLines({ ...DEFAULT_LETTERHEAD, fullRow: ['address', 'site:연구소'] }, COMPANY, SITES2);
  assert.deepEqual(lines.filter((l) => l.full).map((l) => l.key), ['address', 'site:연구소']);
});

test('회사 정보 설정 목록 — 값이 비어도 고를 수 있게 모든 후보를, 켜짐 여부와 함께', () => {
  const entries = letterheadEntries({ ...DEFAULT_LETTERHEAD, items: ['address', 'labAddress', 'tel'], siteNames: [] }, { address: 'x' }, SITES2);
  assert.deepEqual(entries.map((e) => [e.key, e.shown]), [
    ['address', true], ['site:연구소', false], ['tel', true], ['fax', false], ['homepage', false], ['email', false],
  ]);
});
