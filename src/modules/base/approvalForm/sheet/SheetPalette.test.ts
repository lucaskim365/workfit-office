import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, type Sheet } from '@/lib/sheet';
import { approvalCellProps } from '@/modules/gw/approval/sheetForm/approvalSheet';
import { applyPart } from './SheetPalette';

const one = { r1: 0, r2: 0, c1: 1, c2: 1 };
const sheetOf = (res: ReturnType<typeof applyPart>): Sheet => {
  assert.ok(!('notice' in res), '막히지 않음');
  return res as Sheet;
};

test('부품 — 누르면 넣고, 같은 부품을 다시 누르면 뺀다(끌어 놓기는 늘 넣기)', () => {
  const s0 = createSheet(2, 2);
  const s1 = sheetOf(applyPart(s0, one, 'input.date', true));
  assert.equal(approvalCellProps(s1, 0, 1).input?.type, 'date');
  const s2 = sheetOf(applyPart(s1, one, 'input.date', true));
  assert.equal(approvalCellProps(s2, 0, 1).input, undefined, '다시 누르면 빠짐');
  // 다른 부품을 누르면 바꾼다
  const s3 = sheetOf(applyPart(s1, one, 'input.user', true));
  assert.equal(approvalCellProps(s3, 0, 1).input?.type, 'user');
  // 끌어 놓기(toggle 없음)는 이미 있어도 그대로 넣기
  assert.equal(approvalCellProps(sheetOf(applyPart(s1, one, 'input.date')), 0, 1).input?.type, 'date');
  // 자동 채우기·직인도 같은 방식
  const b1 = sheetOf(applyPart(s0, one, 'bind.draft.drafter', true));
  assert.equal(approvalCellProps(b1, 0, 1).bind, 'draft.drafter');
  assert.equal(approvalCellProps(sheetOf(applyPart(b1, one, 'bind.draft.drafter', true)), 0, 1).bind, undefined);
  const seal = sheetOf(applyPart(s0, one, 'seal', true));
  assert.equal(approvalCellProps(seal, 0, 1).seal, true);
  assert.equal(approvalCellProps(sheetOf(applyPart(seal, one, 'seal', true)), 0, 1).seal, false);
});
