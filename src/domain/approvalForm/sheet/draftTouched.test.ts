import assert from 'node:assert/strict';
import test from 'node:test';
import { cellKey, createSheet, setCellMeta, setCellValue, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, applyValues, clearConditionHidden, setCellName, setRowCondition, sheetDocFields } from './approvalSheet';
import { SHEET_OWN_KEY } from './ownSheet';
import { addRepeatRow, expandRepeats, repeatSections, setRepeatSection } from './repeatRows';
import { sheetDraftTouched } from './draftTouched';

/**
 * 0행: 구분(B1 선택, 이름 '구분', 미리 '일반')
 * 1행: 품명(A2 입력) · 수량(B2 숫자) · 금액(C2 =B2*10) — 반복 구간
 * 2행: 합계 C3 =SUM(C2:C2) (금액 키)
 * 3행: 비고(B4 입력, 미리 '없음') — 구분이 '특별'일 때만 보임
 */
function form(): Sheet {
  let s = createSheet(4, 3);
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'select', options: ['일반', '특별'] });
  s = setCellValue(s, 0, 1, '일반');
  s = setCellName(s, 0, 1, '구분');
  s = setCellMeta(s, APPROVAL_NS.input, 1, 0, { type: 'text' });
  s = setCellMeta(s, APPROVAL_NS.input, 1, 1, { type: 'number' });
  s = setCellValue(s, 1, 2, '=B2*10');
  s = setCellValue(s, 2, 2, '=SUM(C2:C2)');
  s = setCellName(s, 2, 2, 'amount');
  s = setCellMeta(s, APPROVAL_NS.input, 3, 1, { type: 'text' });
  s = setCellValue(s, 3, 1, '없음');
  s = setRowCondition(s, 3, 3, { name: '구분', values: ['특별'] });
  return setRepeatSection(s, 1, 1, '품목');
}

/** 작성 화면이 문서 값으로 올려 보내는 것(SheetDraftForm 의 emit 과 같은 길) */
const emitted = (tpl: Sheet, values: Record<string, string> = {}, extras: Record<string, number> = {}) => {
  const s = clearConditionHidden(applyValues(expandRepeats(tpl, extras), values, { recalc: true })).sheet;
  return sheetDocFields(s, '서식@v1', extras);
};

test('시트를 열기만 한 문서 — 예약 키·수식 결과·미리 적힌 값이 있어도 쓴 것이 없다', () => {
  const tpl = form();
  const fields = emitted(tpl);
  assert.ok(fields.__values.includes('일반'), '틀이 처음 내보낸 값이 들어 있다');
  assert.equal(fields.amount, '0');
  assert.equal(sheetDraftTouched(tpl, fields), false);
  // 사람 칸 ID·이름 값 같은 다른 예약 키가 붙어도 같다
  assert.equal(sheetDraftTouched(tpl, { ...fields, __refs: '{}', __named: '{"구분":"일반"}' }), false);
  assert.equal(sheetDraftTouched(tpl, {}), false, '아직 시트가 값을 내보내기 전');
});

test('기안자가 입력 칸에 쓰거나, 미리 적힌 값을 바꾸거나 지우면 쓴 것', () => {
  const tpl = form();
  const [a, b] = tpl.cols;
  assert.equal(sheetDraftTouched(tpl, emitted(tpl, { [cellKey(1, a)]: '태블릿' })), true);
  assert.equal(sheetDraftTouched(tpl, emitted(tpl, { [cellKey(0, b)]: '특별' })), true);
  assert.equal(sheetDraftTouched(tpl, emitted(tpl, { [cellKey(0, b)]: '' })), true);
  // 썼다가 도로 지우면 안 쓴 것
  assert.equal(sheetDraftTouched(tpl, emitted(tpl, { [cellKey(1, a)]: '' })), false);
});

test('줄을 더하거나 표 모양을 고쳤으면 쓴 것', () => {
  const tpl = form();
  const id = repeatSections(tpl)[0].id;
  const base = emitted(tpl);
  const added = addRepeatRow(tpl, {}, JSON.parse(base.__values), id);
  assert.equal(sheetDraftTouched(tpl, emitted(tpl, added.values, added.extras)), true);
  assert.equal(sheetDraftTouched(tpl, { ...base, [SHEET_OWN_KEY]: JSON.stringify(tpl) }), true);
  assert.equal(sheetDraftTouched(tpl, { ...base, [SHEET_OWN_KEY]: '' }), false);
});
