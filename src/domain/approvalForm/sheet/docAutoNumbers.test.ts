import assert from 'node:assert/strict';
import test from 'node:test';
import { cellKey, createSheet, setCellMeta, type Sheet } from '@/lib/sheet/core';
import { DEFAULT_AUTO_NUMBER } from '@/domain/approvalForm/autoNumber';
import { APPROVAL_NS, SHEET_VALUES_KEY, setCellName, setRowCondition } from './approvalSheet';
import { SHEET_ROWS_KEY, repeatSections, setRepeatSection } from './repeatRows';
import { docAutoNumberCells } from './docAutoNumbers';

/** 0행 구분(선택) / 1행 수입 번호(구분=수입일 때만) / 2행 품목(반복 구간) / 3행 관리번호 */
function form(): Sheet {
  let s = createSheet(4, 2);
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'select', options: ['국내', '수입'] });
  s = setCellName(s, 0, 1, 'kind');
  s = setCellMeta(s, APPROVAL_NS.autoNo, 1, 1, { ...DEFAULT_AUTO_NUMBER, prefix: 'IMP' });
  s = setRowCondition(s, 1, 1, { name: 'kind', values: ['수입'] });
  s = setRepeatSection(s, 2, 2, '품목');
  s = setCellMeta(s, APPROVAL_NS.autoNo, 3, 1, { ...DEFAULT_AUTO_NUMBER, prefix: 'NO' });
  return s;
}
const vals = (s: Sheet, kind: string, extra = 0) => ({
  [SHEET_VALUES_KEY]: JSON.stringify({ [cellKey(0, s.cols[1])]: kind }),
  [SHEET_ROWS_KEY]: JSON.stringify(extra ? { [repeatSections(s)[0].id]: extra } : {}),
});

test('상신 번호 칸 — 조건으로 숨은 행은 번호를 받지 않음', () => {
  const s = form();
  assert.deepEqual(docAutoNumberCells(s, vals(s, '국내')).map((x) => x.config.prefix), ['NO']);
  assert.deepEqual(docAutoNumberCells(s, vals(s, '수입')).map((x) => x.config.prefix), ['IMP', 'NO']);
  // 순번 채널은 서식 틀 순서 그대로(숨은 칸이 빠져도 NO 는 sheet#2)
  assert.equal(docAutoNumberCells(s, vals(s, '국내'))[0].channelKey, 'sheet#2');
});

test('상신 번호 칸 — 반복 구간에 더한 줄만큼 아래 칸 자리가 밀린다', () => {
  const s = form();
  const cells = docAutoNumberCells(s, vals(s, '국내', 2));
  assert.equal(cells[0].key, cellKey(5, s.cols[1]));
  assert.deepEqual(docAutoNumberCells(null, {}), []);
});
