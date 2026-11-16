import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, setCellMeta, setCellValue } from '@/lib/sheet';
import { approvalFormSchema, formFieldSchema } from '@/domain/approvalForm/schema';
import { APPROVAL_NS, setCellName } from '@/domain/approvalForm/sheet/approvalSheet';
import { routeConditionFields } from './conditionFields';

const form = (fields: Record<string, unknown>[]) =>
  approvalFormSchema.parse({ id: 'f', code: 'f', name: '서식', fields: fields.map((f) => formFieldSchema.parse(f)) });

/** A1 '지출 항목' | B1 선택 칸(이름 expenseItem), A2 '결제 수단' | B2 선택 칸(이름 payBy) */
function sheet() {
  let s = createSheet(2, 2);
  s = setCellValue(s, 0, 0, '지출 항목');
  s = setCellMeta(s, APPROVAL_NS.input, 0, 1, { type: 'select', options: ['식대', '교통비'] });
  s = setCellName(s, 0, 1, 'expenseItem');
  s = setCellValue(s, 1, 0, '결제 수단');
  s = setCellMeta(s, APPROVAL_NS.input, 1, 1, { type: 'select', options: ['법인카드', '개인카드'] });
  s = setCellName(s, 1, 1, 'payBy');
  return s;
}

test('규칙 조건 후보 — 처음부터 시트로 만든 서식(항목 없음)은 시트의 이름 붙은 선택 칸', () => {
  assert.deepEqual(routeConditionFields(form([]), sheet()), [
    { key: 'expenseItem', label: '지출 항목', options: ['식대', '교통비'] },
    { key: 'payBy', label: '결제 수단', options: ['법인카드', '개인카드'] },
  ]);
});

test('규칙 조건 후보 — 기존 양식은 선택 항목만, 시트를 붙였으면 같은 키는 한 번(항목은 합침, 기존 항목 먼저)·새 칸은 더함', () => {
  const legacy = form([
    { key: 'expenseItem', label: '경비 항목', type: '선택', options: ['식대', '회의비'] },
    { key: 'memo', label: '메모', type: '텍스트' },
    { key: 'tags', label: '태그', type: '다중선택', options: ['a'] },
  ]);
  assert.deepEqual(routeConditionFields(legacy, null), [{ key: 'expenseItem', label: '경비 항목', options: ['식대', '회의비'] }]);
  assert.deepEqual(routeConditionFields(legacy, sheet()), [
    { key: 'expenseItem', label: '경비 항목', options: ['식대', '회의비', '교통비'] }, // 시트에서 더한 항목(교통비)도 고를 수 있게 합친다
    { key: 'payBy', label: '결제 수단', options: ['법인카드', '개인카드'] },
  ]);
  assert.deepEqual(routeConditionFields(null, null), []);
});
