import assert from 'node:assert/strict';
import test from 'node:test';
import { FORM_CODE_MAX, suggestFormCode } from './formCode';

test('새 서식 코드 — 서식명에서 공백·기호를 빼고, 겹치면 숫자', () => {
  assert.equal(suggestFormCode('구매 요청서', []), '구매요청서');
  assert.equal(suggestFormCode('발주서(시트)', []), '발주서시트');
  assert.equal(suggestFormCode('휴가원', ['휴가원', '휴가원2']), '휴가원3');
  assert.equal(suggestFormCode('Leave', ['leave']), 'Leave2');
  assert.equal(suggestFormCode('  !!  ', []), '서식');
  assert.equal(suggestFormCode('가'.repeat(40), ['가'.repeat(FORM_CODE_MAX)]).length, FORM_CODE_MAX);
});
