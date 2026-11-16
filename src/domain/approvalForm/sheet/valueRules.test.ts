import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, setCellValue, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, approvalCellProps, rowConditionOf, setApprovalProp, setCellName, setRowCondition } from './approvalSheet';
import { setRepeatSection } from './repeatRows';
import {
  clearDependent,
  dependentCells,
  dependentCheck,
  ensureSourceName,
  makeDependent,
  removeRowsFor,
  rowsShownFor,
  rowsWithOtherCondition,
  setBranchOptions,
  showRowsFor,
  valueSourceAt,
  valueSources,
} from './valueRules';

const at = (r: number, c: number) => ({ r1: r, r2: r, c1: c, c2: c });

/** 0행: '지출 항목' | 선택(식대·회의비·직접입력), 1행: '분류' | 빈 칸, 2~5행 아무 행 */
function base(): Sheet {
  let s = createSheet(6, 2);
  s = setCellValue(s, 0, 0, '지출 항목');
  s = setApprovalProp(s, at(0, 1), APPROVAL_NS.input, { type: 'select', options: ['식대', '회의비', '직접입력'] });
  s = setCellValue(s, 1, 0, '분류');
  return s;
}

test('기준 칸 — 선택·여러 선택·체크 칸만, 직접입력은 값에서 뺀다', () => {
  const s = base();
  assert.deepEqual(valueSourceAt(s, 0, 1), { r: 0, c: 1, name: undefined, label: '지출 항목', options: ['식대', '회의비'], kind: 'select' });
  assert.equal(valueSourceAt(s, 1, 1), null);
  assert.equal(valueSources(s).length, 1);
});

test('기준 칸 이름 — 없으면 이름표로 지어 붙이고, 있으면 그대로, 겹치면 숫자', () => {
  const s = base();
  const a = ensureSourceName(s, 0, 1);
  assert.equal(a.name, '지출항목');
  assert.equal(approvalCellProps(a.sheet, 0, 1).name, '지출항목');
  assert.equal(ensureSourceName(a.sheet, 0, 1).sheet, a.sheet, '이미 있으면 그대로');
  // 같은 이름표의 다른 칸
  let s2 = setCellValue(a.sheet, 2, 0, '지출 항목');
  s2 = setApprovalProp(s2, at(2, 1), APPROVAL_NS.input, { type: 'checkbox' });
  assert.equal(ensureSourceName(s2, 2, 1).name, '지출항목2');
  // 시스템 이름(금액 키 amount)과는 안 겹친다
  const named = setCellName(base(), 0, 1, 'amount');
  assert.equal(ensureSourceName(named, 0, 1).name, 'amount', '이미 붙은 이름은 존중');
});

test('이 값일 때 보이는 행 — 더하기·빼기·묶어 보기, 다른 기준 칸 조건은 덮는다', () => {
  let s = ensureSourceName(base(), 0, 1).sheet;
  s = showRowsFor(s, 2, 3, '지출항목', '회의비');
  s = showRowsFor(s, 3, 3, '지출항목', '식대');
  assert.deepEqual(rowsShownFor(s, '지출항목', '회의비'), [{ r1: 2, r2: 3 }]);
  assert.deepEqual(rowConditionOf(s, 3), { name: '지출항목', values: ['회의비', '식대'] });
  s = removeRowsFor(s, 2, 2, '지출항목', '회의비');
  assert.equal(rowConditionOf(s, 2), undefined, '값이 다 빠지면 조건 없음');
  // 다른 기준 칸 조건이 걸린 행
  s = showRowsFor(s, 4, 4, '다른칸', '예');
  assert.deepEqual(rowsWithOtherCondition(s, 3, 4, '지출항목'), [4]);
  s = showRowsFor(s, 4, 4, '지출항목', '식대');
  assert.deepEqual(rowConditionOf(s, 4), { name: '지출항목', values: ['식대'] });
});

test('종속 칸 — 만들기·갈래 항목·풀기, 기존 갈래 키는 지킨다', () => {
  let s = ensureSourceName(base(), 0, 1).sheet;
  s = makeDependent(s, 1, 1, '지출항목');
  assert.deepEqual(dependentCells(s, '지출항목').map((d) => [d.r, d.c, d.label]), [[1, 1, '분류']]);
  s = setBranchOptions(s, 1, 1, '식대', ['간식대', '야근식대']);
  assert.deepEqual(approvalCellProps(s, 1, 1).input, {
    type: 'select',
    options: ['간식대', '야근식대'],
    depends: { name: '지출항목', branches: [{ when: '식대', options: ['간식대', '야근식대'] }] },
  });
  // 갈래를 비우면 그 값일 때 칸을 못 씀(갈래 빠짐), 키가 있던 갈래는 남긴다
  s = setApprovalProp(s, at(1, 1), APPROVAL_NS.input, {
    type: 'select',
    options: ['우편'],
    depends: { name: '지출항목', branches: [{ when: '운반비', options: ['우편'], key: 'sort_carr' }] },
  });
  s = setBranchOptions(s, 1, 1, '운반비', []);
  assert.deepEqual(approvalCellProps(s, 1, 1).input?.depends?.branches, [{ when: '운반비', options: [], key: 'sort_carr' }]);
  s = clearDependent(setBranchOptions(s, 1, 1, '식대', ['간식대']), 1, 1);
  assert.equal(approvalCellProps(s, 1, 1).input?.depends, undefined);
  assert.deepEqual(approvalCellProps(s, 1, 1).input?.options, ['간식대']);
});

test('자동 이름 — 칸을 지워 남은 조건 이름·종속 이름·갈래 키와도 겹치지 않게, 숫자뿐인 이름표는 조건칸', () => {
  let s = base();
  // 칸 이름은 지웠는데 행 조건이 아직 '지출항목'을 가리킴
  s = setRowCondition(s, 3, 3, { name: '지출항목', values: ['식대'] });
  assert.equal(ensureSourceName(s, 0, 1).name, '지출항목2');
  s = setCellValue(s, 5, 0, '1.');
  s = setApprovalProp(s, at(5, 1), APPROVAL_NS.input, { type: 'checkbox' });
  assert.equal(ensureSourceName(s, 5, 1).name, '조건칸');
});

test('종속 칸 고르기 검사 — 이름표·수식·자기 자신은 막고, 선택 칸이 아니거나 다른 기준의 종속이면 묻는다', () => {
  let s = ensureSourceName(base(), 0, 1).sheet;
  const src = { r: 0, c: 1, name: '지출항목' };
  assert.ok(dependentCheck(s, 0, 1, src).block, '자기 자신');
  assert.ok(dependentCheck(s, 1, 0, src).block, '이름표');
  assert.deepEqual(dependentCheck(s, 1, 1, src), {}, '빈 칸');
  s = setApprovalProp(s, at(2, 1), APPROVAL_NS.input, { type: 'date' });
  assert.ok(dependentCheck(s, 2, 1, src).ask, '날짜 칸');
  s = setApprovalProp(s, at(3, 1), APPROVAL_NS.input, { type: 'select', options: ['a'], depends: { name: '다른칸', branches: [] } });
  assert.ok(dependentCheck(s, 3, 1, src).ask, '다른 기준의 종속');
  // 같은 기준으로 다시 고르면 갈래·키를 그대로 둔다
  const keep = { type: 'select' as const, options: ['우편'], depends: { name: '지출항목', branches: [{ when: '운반비', options: ['우편'], key: 'sort_carr' }] } };
  s = setApprovalProp(s, at(4, 1), APPROVAL_NS.input, keep);
  assert.deepEqual(dependentCheck(s, 4, 1, src), {});
  assert.equal(makeDependent(s, 4, 1, '지출항목'), s);
});

test('반복 구간 안 이름 없는 선택 칸은 기준 칸 후보가 아니다', () => {
  let s = setApprovalProp(base(), at(3, 1), APPROVAL_NS.input, { type: 'select', options: ['가'] });
  s = setRepeatSection(s, 3, 4, '내역');
  assert.equal(valueSourceAt(s, 3, 1), null);
  assert.ok(valueSourceAt(setCellName(s, 3, 1, '구분'), 3, 1), '이름이 있으면 후보');
});
