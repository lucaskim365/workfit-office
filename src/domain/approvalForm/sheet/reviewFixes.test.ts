import assert from 'node:assert/strict';
import test from 'node:test';
import { cellKey, createSheet, mergeRange, setCellMeta, setCellValue, setRowMeta } from '@/lib/sheet/core';
import { APPROVAL_NS, SHEET_VALUES_KEY, clearConditionHidden, conditionHiddenRows, invalidNumberCells, setCellName, setRowCondition } from './approvalSheet';
import { SHEET_ROWS_KEY, expandRepeats, repeatSections, setRepeatSection } from './repeatRows';
import { withoutExternalRows } from './sheetHeader';
import { DEFAULT_AUTO_NUMBER } from '@/domain/approvalForm/autoNumber';
import { docAutoNumberCells } from './docAutoNumbers';

test('반복 구간 행 추가 — 한 줄 구간의 가로 병합은 늘리지 않고 새 줄에 복사', () => {
  let s = createSheet(3, 4);
  s = mergeRange(s, { r1: 1, r2: 1, c1: 1, c2: 3 });
  s = setRepeatSection(s, 1, 1, '품목');
  const id = repeatSections(s)[0].id;
  const out = expandRepeats(s, { [id]: 2 });
  const rowMerges = out.merges.filter((m) => m.startCol === 1).map((m) => [m.startRow, m.rowSpan, m.colSpan]);
  assert.deepEqual(rowMerges.sort(), [[1, 1, 3], [2, 1, 3], [3, 1, 3]]);
});

test('조건으로 숨은 행 — 입력 값·사람 ID 를 비우고 합계에서 빠짐', () => {
  // 0행 구분(선택) / 1행 식대 금액(구분=식대일 때만) / 2행 합계 =B2
  let s = createSheet(3, 2);
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'select', options: ['식대', '교통비'] });
  s = setCellName(s, 0, 1, 'kind');
  s = setCellMeta(s, APPROVAL_NS.input, 1, 1, { type: 'currency' });
  s = setRowCondition(s, 1, 1, { name: 'kind', values: ['식대'] });
  s = setCellValue(s, 2, 1, '=B2');
  s = setCellValue(setCellValue(s, 0, 1, '교통비'), 1, 1, '50000');
  const k = cellKey(1, s.cols[1]);
  const res = clearConditionHidden(s, { [k]: 'U1', other: 'U2' });
  assert.equal(res.sheet.rows[1][s.cols[1]], '');
  assert.notEqual(String(res.sheet.rows[2][s.cols[1]] ?? ''), '50000'); // 합계에 숨은 값이 안 남음
  assert.deepEqual(res.refs, { other: 'U2' });
  // 보이는 행은 그대로
  const meal = setCellValue(s, 0, 1, '식대');
  assert.equal(clearConditionHidden(meal).sheet, meal);
  // 숨은 행의 숫자 검사는 건너뜀
  assert.deepEqual(invalidNumberCells(setCellValue(s, 1, 1, 'abc')), []);
});

test('대외 문서 — 조건 칸이 대외 숨김 행에 있어도 조건으로 숨은 행은 빠진다', () => {
  let s = createSheet(3, 2);
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'select', options: ['식대', '교통비'] });
  s = setCellName(s, 0, 1, 'kind');
  s = setCellValue(s, 0, 1, '교통비');
  s = setRowMeta(s, APPROVAL_NS.extHide, 0, true);
  s = setRowCondition(s, 1, 1, { name: 'kind', values: ['식대'] });
  s = setCellValue(s, 1, 0, '식대 분류');
  s = setCellValue(s, 2, 0, '금액');
  const out = withoutExternalRows(s, conditionHiddenRows(s));
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0][s.cols[0]], '금액');
});

test('자동번호 자리 — 줄 수는 펼친 모양과 같게(상한·정수)', () => {
  let s = createSheet(3, 2);
  s = setRepeatSection(s, 0, 0, '품목');
  s = setCellMeta(s, APPROVAL_NS.autoNo, 2, 1, DEFAULT_AUTO_NUMBER);
  const id = repeatSections(s)[0].id;
  const at = (n: number) => docAutoNumberCells(s, { [SHEET_VALUES_KEY]: '{}', [SHEET_ROWS_KEY]: JSON.stringify({ [id]: n }) })[0].r;
  assert.equal(at(2.7), 4);
  assert.equal(at(250), 202);
});
