import assert from 'node:assert/strict';
import test from 'node:test';
import { cellKey, createSheet, setCellMeta } from '@/lib/sheet';
import { DEFAULT_AUTO_NUMBER } from './autoNumber';
import { SHEET_AUTO_NO_NS, fillSheetAutoNumbers, sheetAutoNumberCells } from './sheetAutoNumber';

test('시트 자동번호 칸 — 위→아래·왼→오른 순서, 칸 구분은 순서(주소 아님)', () => {
  let s = createSheet(5, 3);
  s = setCellMeta(s, SHEET_AUTO_NO_NS, 3, 0, { ...DEFAULT_AUTO_NUMBER, prefix: 'B' });
  s = setCellMeta(s, SHEET_AUTO_NO_NS, 1, 2, { ...DEFAULT_AUTO_NUMBER, prefix: 'A', asDocNo: true });
  const cells = sheetAutoNumberCells(s);
  assert.deepEqual(
    cells.map((c) => [c.key, c.config.prefix, c.channelKey]),
    [
      [cellKey(1, s.cols[2]), 'A', 'sheet#1'],
      [cellKey(3, s.cols[0]), 'B', 'sheet#2'],
    ]
  );
  assert.deepEqual(sheetAutoNumberCells(null), []);
});

test('상신 때 번호 넣기 — 빈 칸만(재상신은 그대로), 문서번호로 쓰는 번호', async () => {
  let s = createSheet(3, 2);
  s = setCellMeta(s, SHEET_AUTO_NO_NS, 0, 0, { ...DEFAULT_AUTO_NUMBER, asDocNo: true });
  s = setCellMeta(s, SHEET_AUTO_NO_NS, 2, 1, DEFAULT_AUTO_NUMBER);
  const cells = sheetAutoNumberCells(s);
  let n = 0;
  const next = async () => `NO-${++n}`;
  const first = await fillSheetAutoNumbers(JSON.stringify({ [cellKey(1, s.cols[0])]: '본문' }), cells, next);
  const vals = JSON.parse(first.valuesJson);
  assert.equal(vals[cells[0].key], 'NO-1');
  assert.equal(vals[cells[1].key], 'NO-2');
  assert.equal(vals[cellKey(1, s.cols[0])], '본문', '다른 칸 값은 그대로');
  assert.equal(first.docNo, 'NO-1');
  // 재상신 — 받은 번호 그대로, 새 번호를 받지 않음
  const again = await fillSheetAutoNumbers(first.valuesJson, cells, next);
  assert.equal(again.valuesJson, first.valuesJson);
  assert.equal(n, 2);
  // 값이 없던 문서도 받는다
  assert.equal(JSON.parse((await fillSheetAutoNumbers(undefined, cells, next)).valuesJson)[cells[0].key], 'NO-3');
});
