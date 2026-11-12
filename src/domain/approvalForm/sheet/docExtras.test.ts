import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, setCellValue } from '@/lib/sheet/core';
import { APPROVAL_NS, approvalCellProps, setApprovalProp } from './approvalSheet';
import { closingStartRow, extrasAnchorRow, extrasCell, extrasHiddenRows, isExtrasDrawCell, withExtrasRow } from './docExtras';
import { insertDocHeader } from './sheetHeader';

const row = (r: number, c1: number, c2: number) => ({ r1: r, r2: r, c1, c2 });

test('맺음말 첫 줄 — 기안일 줄 아래 기안자 서명 줄, 그 위 문구 줄·빈 줄까지', () => {
  const s = insertDocHeader(setCellValue(createSheet(2, 4), 0, 0, '본문'));
  const sign = s.rows.length - 1;
  assert.equal(approvalCellProps(s, sign, 0).bind, 'draft.sign');
  assert.equal(closingStartRow(s), sign - 3, '빈 줄 · 문구 · 기안일 · 서명');
  // 맺음말을 끈 서식(공문 등) — 없음
  assert.equal(closingStartRow(insertDocHeader(createSheet(2, 4), { closingBlock: false })), null);
  // 표 안의 기안일·서명이 붙어 있지 않으면 맺음말로 보지 않는다
  let t = setApprovalProp(createSheet(6, 2), row(1, 0, 0), APPROVAL_NS.bind, 'draft.date');
  t = setApprovalProp(t, row(4, 0, 0), APPROVAL_NS.bind, 'draft.sign');
  assert.equal(closingStartRow(t), null);
});

test('그릴 시트에 자리 줄 끼우기 — 맺음말 바로 위 한 줄(합침), 맺음말이 없으면 그대로', () => {
  const s = insertDocHeader(setCellValue(createSheet(2, 4), 0, 0, '본문'));
  const at = closingStartRow(s)!;
  const out = withExtrasRow(s);
  assert.equal(out.rows.length, s.rows.length + 1);
  assert.deepEqual(extrasCell(out), { r: at, c: 0 });
  assert.ok(out.merges.some((m) => m.startRow === at && m.startCol === 0 && m.colSpan === 4));
  assert.equal(approvalCellProps(out, out.rows.length - 1, 0).bind, 'draft.sign', '맺음말은 한 줄 아래로');
  assert.equal(withExtrasRow(out), out, '이미 있으면 그대로');
  const noClosing = insertDocHeader(createSheet(2, 4), { closingBlock: false });
  assert.equal(withExtrasRow(noClosing), noClosing);
  assert.equal(extrasAnchorRow(noClosing), null);
});

test('예전에 저장한 자리 줄 — 그 줄을 자리로, 여럿이면 첫 자리만 그림', () => {
  let s = setCellValue(createSheet(6, 2), 0, 0, '본문');
  s = setApprovalProp(s, row(2, 0, 0), APPROVAL_NS.bind, 'doc.extras');
  s = setApprovalProp(s, row(4, 1, 1), APPROVAL_NS.bind, 'doc.extras');
  assert.equal(extrasAnchorRow(s), 2);
  assert.deepEqual([...extrasHiddenRows(s, false)].sort(), [2, 4]);
  assert.deepEqual([...extrasHiddenRows(s, true)], [4]);
  assert.ok(isExtrasDrawCell(s, 2, 0));
  assert.ok(!isExtrasDrawCell(s, 4, 1));
});
