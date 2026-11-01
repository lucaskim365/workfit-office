import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_LETTERHEAD, headerShown, letterheadLines, titleFieldOf } from './headerItems';
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

test('회사 정보 머리글 — 고른 항목만, 빈 값은 뺀다, 연구소는 서식 입력값', () => {
  const lines = letterheadLines(
    { items: ['address', 'labAddress', 'fax'], labAddress: '대전 유성구 연구로 1' },
    { address: '서울 강남구 1', fax: '', tel: '02-000-0000' },
  );
  assert.deepEqual(lines.map((l) => [l.item, l.value]), [['address', '서울 강남구 1'], ['labAddress', '대전 유성구 연구로 1']]);
  assert.equal(letterheadLines(DEFAULT_LETTERHEAD, { tel: '02-1' }).length, 1);
});

test('보이는 문서번호 — 문서번호로 쓰는 자동번호가 있으면 그것, 없으면 AP 번호', () => {
  assert.equal(docNoOf({ docNo: 'AP-261101-001', fieldValues: {} }), 'AP-261101-001');
  assert.equal(docNoOf({ docNo: 'AP-261101-001', fieldValues: { [DOC_NO_VALUE_KEY]: '20261101 - 01호' } }), '20261101 - 01호');
});
