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

test('기안자 열 넣기 — 문서 머리 행(기안 정보 칸)에 생긴 새 칸은 왼쪽 칸에 합쳐 모양이 그대로', async () => {
  const { draftInsertCol } = await import('./ownSheet');
  let s = createSheet(2, 3);
  s = setCellValue(s, 0, 0, '기안부서');
  s = setCellMeta(s, APPROVAL_NS.bind, 0, 1, 'draft.dept');
  const next = draftInsertCol(s, 2);
  assert.equal(next.cols.length, 4);
  // 머리 행: 기안부서 값 칸(B)이 새 칸(C)까지 합쳐짐, 표 행(2행)은 그대로 갈라짐
  assert.deepEqual(next.merges, [{ startRow: 0, startCol: 1, rowSpan: 1, colSpan: 2 }]);
});

test('병합 — 왼쪽 위가 빈 칸이면 옆 칸의 글자·부품을 왼쪽 위로 옮겨 합친다(보호 칸도 잃지 않으니 기안자도 가능)', async () => {
  const { mergeApprovalRange } = await import('./approvalSheet');
  const { draftCanMerge } = await import('./ownSheet');
  let s = createSheet(1, 2);
  s = setCellValue(s, 0, 1, '홍길동');
  s = setCellMeta(s, APPROVAL_NS.bind, 0, 1, 'draft.name');
  const range = { r1: 0, c1: 0, r2: 0, c2: 1 };
  assert.equal(draftCanMerge(s, range), true);
  const m = mergeApprovalRange(s, range);
  assert.equal(String(m.rows[0][m.cols[0]]), '홍길동');
  assert.deepEqual(m.cellMeta[APPROVAL_NS.bind], { [`0:${m.cols[0]}`]: 'draft.name' });
  assert.deepEqual(draftEditIssues(s, m), []);
  // 왼쪽 위에 글자가 있으면 그 칸 기준 — 보호 칸을 덮는 병합은 기안자에게 막힘
  const s2 = setCellValue(s, 0, 0, '기안자');
  assert.equal(draftCanMerge(s2, range), false);
});
