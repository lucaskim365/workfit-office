import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INITIAL_COMPANY_CLASSES,
  newBizCategoryId,
  newCompanyClassId,
  nextOrder,
  sortMasters,
  validateMasterName,
} from './masters';

const row = (id: string, name: string, use = true, order = 10) => ({ id, name, use, order });

test('이름 검사 — 필수, 공백·대소문자 무시 중복(사용 안 함 포함), 자기 자신 제외', () => {
  assert.deepEqual(validateMasterName('  ', [], '기업분류'), ['기업분류 이름을 입력하세요.']);
  assert.deepEqual(validateMasterName('제조 AI', [row('A', '제조AI')], '사업구분'), ['이미 있는 사업구분입니다(제조AI).']);
  assert.deepEqual(validateMasterName('제조ai', [row('A', '제조AI', false)], '사업구분'), ['이미 있는 사업구분입니다(제조AI, 사용 안 함). 그 항목을 다시 사용으로 바꾸세요.']);
  assert.deepEqual(validateMasterName('제조AI', [row('A', '제조AI')], '사업구분', 'A'), []);
  assert.deepEqual(validateMasterName('부처협업형', [row('A', '제조AI')], '사업구분'), []);
});

test('정렬 — 사용 중 먼저, 순서, 이름', () => {
  const s = sortMasters([row('a', '나', false, 1), row('b', '다', true, 20), row('c', '가', true, 20), row('d', '라', true, 10)]);
  assert.deepEqual(s.map((r) => r.id), ['d', 'c', 'b', 'a']);
});

test('다음 순서 — 가장 큰 순서 + 10, 없으면 10', () => {
  assert.equal(nextOrder([]), 10);
  assert.equal(nextOrder([row('a', 'x', true, 30), row('b', 'y', false, 50)]), 60);
});

test('초기 기업분류 — 도입기업은 프로젝트당 한 곳, 매입기업은 여러 곳', () => {
  assert.deepEqual(INITIAL_COMPANY_CLASSES.map((c) => [c.name, c.singlePerProject]), [['도입기업', true], ['매입기업', false]]);
});

test('ID 머리 — CCL·BCT', () => {
  assert.match(newCompanyClassId(), /^CCL-[a-z0-9]+$/);
  assert.match(newBizCategoryId(), /^BCT-[a-z0-9]+$/);
});
