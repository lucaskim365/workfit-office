import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_LETTERHEAD, headerShown, letterheadLines, letterheadSiteOptions, titleFieldOf } from './headerItems';
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
