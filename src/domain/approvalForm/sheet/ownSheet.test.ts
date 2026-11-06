import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSheet, deleteCol, deleteRow, insertCol, insertRow, setCellMeta, setCellValue, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS } from './approvalSheet';
import { SHEET_OWN_KEY, canDraftDelete, docTemplateOf, draftEditIssues, draftEditSetValue, keepRefsAfterEdit } from './ownSheet';

/** 3×3 — B3 = 금액 합계(이름 amount, 수식), A1 = 입력 칸, A2 = 일반 글자 */
function base(): Sheet {
  let s = createSheet(3, 3);
  s = setCellValue(s, 0, 0, '품목');
  s = setCellMeta(s, APPROVAL_NS.input, 0, 0, { type: 'text' });
  s = setCellValue(s, 1, 0, '비고');
  s = setCellValue(s, 2, 1, '=SUM(B1:B2)');
  s = setCellMeta(s, APPROVAL_NS.name, 2, 1, 'amount');
  return s;
}

test('보호 칸이 든 행·열은 지울 수 없다', () => {
  const s = base();
  assert.equal(canDraftDelete(s, 'row', 2), false);
  assert.equal(canDraftDelete(s, 'col', 1), false);
  assert.equal(canDraftDelete(s, 'row', 1), true);
  assert.equal(canDraftDelete(s, 'col', 2), true);
});

test('입력 칸이 아닌 보호 칸(금액 합계)은 내용·수식을 바꿀 수 없고, 일반 칸·입력 칸은 쓸 수 있다', () => {
  const s = base();
  assert.equal(draftEditSetValue(s, 2, 1, '100'), null);
  assert.ok(draftEditSetValue(s, 1, 0, '바꾼 글자'));
  assert.ok(draftEditSetValue(s, 0, 0, '입력'));
});

test('열·행을 넣어 자리가 옮겨져도 보호 칸이 그대로면 문제없다', () => {
  const s = base();
  assert.deepEqual(draftEditIssues(s, insertRow(insertCol(s, 0), 0)), []);
  assert.deepEqual(draftEditIssues(s, deleteRow(s, 1)), []);
});

test('보호 칸이 지워지거나 바뀌면 알린다', () => {
  const s = base();
  assert.ok(draftEditIssues(s, deleteCol(s, 1)).length > 0);
  // 합계 수식을 숫자로 덮어씀(편집기 밖 경로로 들어온 경우까지)
  assert.ok(draftEditIssues(s, setCellValue(s, 2, 1, '100')).length > 0);
});

test('문서 시트가 있으면 그것을 틀로, 없으면 서식 틀', () => {
  const tpl = base();
  const own = insertCol(tpl, 0);
  assert.equal(docTemplateOf(tpl, {}), tpl);
  assert.equal(docTemplateOf(tpl, { [SHEET_OWN_KEY]: JSON.stringify(own) })!.cols.length, own.cols.length);
  assert.equal(docTemplateOf(tpl, { [SHEET_OWN_KEY]: '' }), tpl);
});

test('사람 칸 ID — 같은 자리에 같은 이름이 남은 칸만 그대로', () => {
  let s = setCellValue(base(), 1, 2, '홍길동 (개발팀)');
  const refs = { [`1:${s.cols[2]}`]: 'U1' };
  assert.deepEqual(keepRefsAfterEdit(refs, s, s), refs);
  assert.deepEqual(keepRefsAfterEdit(refs, s, insertRow(s, 0)), {});
});
