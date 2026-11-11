import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, setCellValue } from '@/lib/sheet/core';
import { APPROVAL_NS, approvalCellProps, setApprovalProp } from './approvalSheet';
import { extrasCell, extrasHiddenRows, hasExtrasPlace, isExtrasDrawCell, placeExtras } from './docExtras';
import { setRepeatSection } from './repeatRows';
import { insertDocHeader } from './sheetHeader';

const row = (r: number, c1: number, c2: number) => ({ r1: r, r2: r, c1, c2 });

test('첨부·관련 문서 자리 넣기 — 한 줄을 합쳐 첫 칸에, 서식에 하나, 반복 구간·여러 줄은 막음', () => {
  const s = createSheet(6, 4);
  const placed = placeExtras(s, row(2, 0, 3));
  assert.ok(!('notice' in placed));
  if ('notice' in placed) return;
  assert.equal(approvalCellProps(placed, 2, 0).bind, 'doc.extras');
  assert.equal(approvalCellProps(placed, 2, 1).bind, undefined, '합친 칸의 첫 칸에만');
  assert.ok(placed.merges.some((m) => m.startRow === 2 && m.startCol === 0 && m.colSpan === 4));
  assert.deepEqual(extrasCell(placed), { r: 2, c: 0 });
  assert.ok('notice' in placeExtras(placed, row(4, 0, 3)), '서식에 하나');
  assert.ok('notice' in placeExtras(s, { r1: 1, r2: 2, c1: 0, c2: 0 }), '한 줄만');
  assert.ok('notice' in placeExtras(setRepeatSection(s, 3, 4, '품목'), row(3, 0, 3)), '반복 구간 밖');
});

test('자리 줄 숨김 — 보일 것이 없으면 줄째, 옛 데이터에 자리가 여럿이면 첫 자리만 그림', () => {
  let s = setCellValue(createSheet(6, 2), 0, 0, '본문');
  assert.equal(hasExtrasPlace(s), false);
  s = setApprovalProp(s, row(2, 0, 0), APPROVAL_NS.bind, 'doc.extras');
  s = setApprovalProp(s, row(4, 1, 1), APPROVAL_NS.bind, 'doc.extras');
  assert.deepEqual([...extrasHiddenRows(s, false)].sort(), [2, 4]);
  assert.deepEqual([...extrasHiddenRows(s, true)], [4]);
  assert.ok(isExtrasDrawCell(s, 2, 0));
  assert.ok(!isExtrasDrawCell(s, 4, 1));
});

test('문서 머리 다시 넣기 — 자리가 이미 있으면 더 넣지 않는다', () => {
  const once = insertDocHeader(createSheet(2, 4));
  const twice = insertDocHeader(once);
  assert.equal(Object.values(twice.cellMeta[APPROVAL_NS.bind] ?? {}).filter((v) => v === 'doc.extras').length, 1);
});
