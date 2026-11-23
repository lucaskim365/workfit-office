import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, setCellValue, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, approvalCellProps, rowConditionOf, setApprovalProp, setCellName, setRowCondition } from './approvalSheet';
import { setRepeatSection } from './repeatRows';
import { DEFAULT_AUTO_NUMBER } from '@/domain/approvalForm/autoNumber';
import {
  clearDependent,
  dependentCells,
  dependentCheck,
  ensureSourceName,
  hasValueRules,
  makeDependent,
  patchSameInputs,
  removeRowsFor,
  rowsShownFor,
  rowsWithOtherCondition,
  ruleSourceKind,
  setBranchOptions,
  showRowsFor,
  staleRuleValues,
  valueRuleIssues,
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

test('종속 칸 고르기 검사 — 저절로 채워지는 칸·자동번호 칸은 막는다', () => {
  let s = ensureSourceName(base(), 0, 1).sheet;
  const src = { r: 0, c: 1, name: '지출항목' };
  s = setApprovalProp(s, at(2, 1), APPROVAL_NS.bind, 'draft.drafter');
  s = setApprovalProp(s, at(3, 1), APPROVAL_NS.autoNo, DEFAULT_AUTO_NUMBER);
  assert.match(dependentCheck(s, 2, 1, src).block ?? '', /저절로 채워지는 칸/);
  assert.match(dependentCheck(s, 3, 1, src).block ?? '', /자동번호 칸/);
});

test('여러 칸을 고른 채 속성 하나 고치기 — 초점 칸과 종류가 같은 칸에만, 고친 속성만', () => {
  // 0행 선택(기준), 1행 종속 선택, 2행 선택(다른 항목), 3행 글, 4행 날짜
  let s = ensureSourceName(base(), 0, 1).sheet;
  s = setBranchOptions(makeDependent(s, 1, 1, '지출항목'), 1, 1, '식대', ['간식대']);
  s = setApprovalProp(s, at(2, 1), APPROVAL_NS.input, { type: 'select', options: ['가', '나'] });
  s = setApprovalProp(s, at(3, 1), APPROVAL_NS.input, { type: 'text', placeholder: '옛 예시' });
  s = setApprovalProp(s, at(4, 1), APPROVAL_NS.input, { type: 'date' });
  const all = { r1: 0, r2: 5, c1: 0, c2: 1 };
  const inputAt = (x: Sheet, r: number) => approvalCellProps(x, r, 1).input;

  // 초점 = 2행 선택 칸에서 '직접입력'을 붙인다 → 선택 칸마다 제 항목 뒤에, 종속 칸·글·날짜 칸은 그대로
  const direct = patchSameInputs(s, all, { r: 2, c: 1 }, (i) => ({ ...i, options: [...(i.options ?? []), '직접입력'] }), { skipDependent: true });
  assert.deepEqual(inputAt(direct, 2)?.options, ['가', '나', '직접입력']);
  assert.deepEqual(inputAt(direct, 0)?.options, ['식대', '회의비', '직접입력', '직접입력']);
  assert.deepEqual(inputAt(direct, 1), inputAt(s, 1), '종속 칸은 그대로');
  assert.deepEqual(inputAt(direct, 3), inputAt(s, 3));
  assert.deepEqual(inputAt(direct, 4), { type: 'date' });
  assert.equal(inputAt(direct, 5), undefined, '입력 칸이 아닌 칸은 입력 칸이 되지 않는다');

  // 초점 = 3행 글 칸에서 입력 예시를 고친다 → 글 칸만
  const ph = patchSameInputs(s, all, { r: 3, c: 1 }, (i) => ({ ...i, placeholder: '새 예시' }));
  assert.deepEqual(inputAt(ph, 3), { type: 'text', placeholder: '새 예시' });
  assert.deepEqual(inputAt(ph, 2), { type: 'select', options: ['가', '나'] });
  assert.deepEqual(inputAt(ph, 1), inputAt(s, 1));
  // 초점 칸이 입력 칸이 아니면 아무것도 바꾸지 않는다
  assert.equal(patchSameInputs(s, all, { r: 5, c: 1 }, (i) => ({ ...i, placeholder: 'x' })), s);
});

test('반복 구간 안 이름 없는 선택 칸은 기준 칸 후보가 아니다', () => {
  let s = setApprovalProp(base(), at(3, 1), APPROVAL_NS.input, { type: 'select', options: ['가'] });
  s = setRepeatSection(s, 3, 4, '내역');
  assert.equal(valueSourceAt(s, 3, 1), null);
  assert.ok(valueSourceAt(setCellName(s, 3, 1, '구분'), 3, 1), '이름이 있으면 후보');
});

test('끊긴 조건 — 고를 항목 이름을 고치면 옛 값에 걸린 행·항목이 남는다(걸린 것으로 세고, 따로 보여 주고, 저장 때 알린다)', () => {
  let s = ensureSourceName(base(), 0, 1).sheet;
  s = showRowsFor(s, 2, 2, '지출항목', '식대');
  s = makeDependent(s, 1, 1, '지출항목');
  s = setBranchOptions(s, 1, 1, '식대', ['간식대', '야근식대']);
  const src = () => valueSourceAt(s, 0, 1)!;
  assert.deepEqual(staleRuleValues(s, src()), []);
  assert.deepEqual(valueRuleIssues(s), []);

  // '식대'를 '식비'로 고친다(직접입력 없음 — 목록 밖 값은 나올 수 없다)
  s = setApprovalProp(s, at(0, 1), APPROVAL_NS.input, { type: 'select', options: ['식비', '회의비'] });
  assert.deepEqual(staleRuleValues(s, src()), ['식대']);
  assert.equal(hasValueRules(s, src()), true, '지금 항목에 없는 값에만 걸려 있어도 걸린 것');
  const issues = valueRuleIssues(s);
  assert.equal(issues.length, 2);
  assert.match(issues[0], /^3행: .*식대.*보이지 않습니다/);
  assert.match(issues[1], /분류\(B2\).*식대.*쓰이지 않습니다/);

  // 직접 입력을 받는 기준 칸도 알린다 — 기안자가 그 값을 똑같이 쳐야만 보이므로(항목 이름을 고친 뒤 남은 옛 값일 수 있다)
  const open = setApprovalProp(s, at(0, 1), APPROVAL_NS.input, { type: 'select', options: ['식비', '직접입력'] });
  const openIssues = valueRuleIssues(open);
  assert.equal(openIssues.length, 2);
  assert.match(openIssues[0], /^3행: .*식대.*직접 입력으로 그 값을 똑같이 써야만 보입니다/);
  assert.match(openIssues[1], /분류\(B2\).*식대.*직접 입력으로 그 값을 똑같이 써야만 쓰입니다/);
});

test('끊긴 조건 — 기준 칸에서 부품을 빼면(이름은 남음) 고르는 칸이 아니고, 이름까지 지우면 없는 칸', () => {
  let s = ensureSourceName(base(), 0, 1).sheet;
  s = showRowsFor(s, 2, 3, '지출항목', '식대');
  s = makeDependent(s, 1, 1, '지출항목');
  assert.equal(ruleSourceKind(s, '지출항목'), 'choice');

  const plain = setApprovalProp(s, at(0, 1), APPROVAL_NS.input, undefined);
  assert.equal(ruleSourceKind(plain, '지출항목'), 'plain');
  const a = valueRuleIssues(plain);
  assert.equal(a.length, 2);
  assert.match(a[0], /^3·4행: .*선택·체크 칸이 아닙니다/);
  assert.match(a[1], /분류\(B2\).*없거나 선택 칸이 아닙니다/);

  const gone = setCellName(plain, 0, 1, undefined);
  assert.equal(ruleSourceKind(gone, '지출항목'), 'missing');
  assert.match(valueRuleIssues(gone)[0], /^3·4행: .*시트에 없어 항상 보입니다/);
});

test('끊긴 조건 — 기존 서식에서 온 갈래 이름(key)에 걸린 행 조건은 문제로 보지 않는다', () => {
  let s = ensureSourceName(base(), 0, 1).sheet;
  s = setApprovalProp(s, at(1, 1), APPROVAL_NS.input, { type: 'select', options: ['간식대'], depends: { name: '지출항목', branches: [{ when: '식대', options: ['간식대'], key: 'mealKind' }] } });
  s = setRowCondition(s, 4, 4, { name: 'mealKind', values: ['간식대'] });
  assert.equal(ruleSourceKind(s, 'mealKind'), 'key');
  assert.deepEqual(valueRuleIssues(s), []);
});
