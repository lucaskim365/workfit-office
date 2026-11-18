import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, deleteRow, setCellValue, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, approvalCellProps, isStructureLocked, mergeApprovalRange, setApprovalProp, setCellName, setRowCondition } from './approvalSheet';
import {
  deleteColsBlock,
  deleteRowsBlock,
  droppedLockedNames,
  dropUnusedRuleNames,
  isLockedName,
  lockInfo,
  lockTitle,
  lockedCells,
  lockedNamesOf,
  mergeBlock,
  saveLockIssues,
  sheetChangeBlock,
} from './linkLock';
import { clearDependent, ensureSourceName, makeDependent, removeRowsFor, showRowsFor } from './valueRules';

const one = (r: number, c: number) => ({ r1: r, r2: r, c1: c, c2: c });

/** 4×4 — B2 휴가 기간(날짜 칸), C3 금액 키 */
function base(): Sheet {
  let s = createSheet(4, 4);
  s = setApprovalProp(s, one(1, 1), APPROVAL_NS.input, { type: 'date' });
  s = setCellName(s, 1, 1, 'period');
  s = setApprovalProp(s, one(2, 2), APPROVAL_NS.input, { type: 'currency' });
  s = setCellName(s, 2, 2, 'amount');
  return s;
}

/** base + A1 선택 칸(식대·교통) — 이름 없음 */
function withSelect(): Sheet {
  return setApprovalProp(base(), one(0, 0), APPROVAL_NS.input, { type: 'select', options: ['식대', '교통'] });
}

const nameAt = (s: Sheet, r: number, c: number) => approvalCellProps(s, r, c).name;

test('잠긴 이름 — 금액 키는 아니고, 연동 이름·직접 쓴 이름은 잠금', () => {
  const s = setCellName(base(), 0, 0, '품명');
  const locked = lockedNamesOf(s);
  assert.equal(isLockedName(locked, 'amount'), false);
  assert.equal(isLockedName(locked, 'period'), true);
  assert.equal(isLockedName(locked, '품명'), true);
  assert.deepEqual([...lockedCells(s, locked).values()].sort(), ['period', '품명']);
});

test('잠긴 이름 — 저장한 판에서 규칙(행 보이기 조건)이 가리키던 직접 쓴 이름은 편집자 몫이라 안 잠금, 연동 이름은 그래도 잠금', () => {
  let s = setCellName(base(), 0, 0, '지출항목');
  s = setRowCondition(s, 3, 3, { name: '지출항목', values: ['식대'] });
  assert.equal(isLockedName(lockedNamesOf(s), '지출항목'), false);
  s = setRowCondition(s, 3, 3, { name: 'period', values: ['x'] });
  assert.equal(isLockedName(lockedNamesOf(s), 'period'), true);
});

test('표시 — 지금 연동 기능의 한글 이름과 기능, 직접 쓴 이름은 관련 문서 값 가져오기', () => {
  assert.deepEqual(lockInfo('period', '휴가'), { label: '휴가 기간', feature: '휴가 차감·근태·캘린더' });
  assert.deepEqual(lockInfo('period', '외근'), { label: '외근 일자', feature: '근태·캘린더' });
  assert.equal(lockTitle('품명', null), '품명 — 관련 문서 값 가져오기에 쓰여요');
});

test('행·열 지우기 — 잠긴 칸이 든 행·열만 막고, 금액 키 행·빈 행은 통과', () => {
  const s = base();
  const locked = lockedNamesOf(s);
  assert.match(deleteRowsBlock(s, 0, 1, '휴가', locked) ?? '', /B2 칸은 '휴가 기간'\(휴가 차감·근태·캘린더\)에 쓰여서 지울 수 없어요/);
  assert.equal(deleteRowsBlock(s, 2, 3, '휴가', locked), null);
  assert.match(deleteColsBlock(s, 1, 1, '휴가', locked) ?? '', /B2 칸/);
  assert.equal(deleteColsBlock(s, 2, 3, '휴가', locked), null);
});

test('병합 — 잠긴 칸이 가려지면 막고, 남는 칸이면 괜찮다(왼쪽 위가 비어 옮겨지는 경우 포함)', () => {
  let s = base();
  const locked = lockedNamesOf(s);
  // A1 에 글자 — A1:B2 병합이면 B2(휴가 기간)가 가려진다
  const withText = setCellValue(s, 0, 0, '기간');
  assert.match(mergeBlock(withText, { r1: 0, c1: 0, r2: 1, c2: 1 }, '휴가', locked) ?? '', /가려지게 합칠 수 없어요/);
  // 왼쪽 위가 빈 칸이면 B2 가 남는 칸 — 왼쪽 위로 옮겨져 이름이 산다
  assert.equal(mergeBlock(s, { r1: 0, c1: 0, r2: 1, c2: 1 }, '휴가', locked), null);
  const merged = mergeApprovalRange(s, { r1: 0, c1: 0, r2: 1, c2: 1 });
  assert.deepEqual(droppedLockedNames(s, merged, locked), []);
  // 잠긴 칸이 왼쪽 위
  assert.equal(mergeBlock(s, { r1: 1, c1: 1, r2: 1, c2: 3 }, '휴가', locked), null);
  // 잠긴 칸 둘
  s = setCellName(s, 1, 2, 'leaveType');
  assert.match(mergeBlock(s, { r1: 1, c1: 1, r2: 1, c2: 2 }, '휴가', lockedNamesOf(s)) ?? '', /'휴가 기간'·'휴가 종류' 칸은 .*한 칸으로 합칠 수 없어요/);
});

test('편집자 동작 — 이름이 사라지거나 잠긴 칸의 입력 종류가 바뀌면 막고, 다른 칸·모양은 통과', () => {
  const s = base();
  const locked = lockedNamesOf(s);
  assert.match(sheetChangeBlock(s, setCellName(s, 1, 1, undefined), '휴가', locked) ?? '', /지울 수 없어요/);
  assert.match(sheetChangeBlock(s, setApprovalProp(s, one(1, 1), APPROVAL_NS.input, { type: 'text' }), '휴가', locked) ?? '', /칸 종류를 바꿀 수 없어요/);
  assert.match(sheetChangeBlock(s, setApprovalProp(s, one(1, 1), APPROVAL_NS.input, undefined), '휴가', locked) ?? '', /칸 종류를 바꿀 수 없어요/);
  assert.equal(sheetChangeBlock(s, setApprovalProp(s, one(0, 0), APPROVAL_NS.input, { type: 'text' }), '휴가', locked), null);
  assert.equal(sheetChangeBlock(s, setApprovalProp(s, one(2, 2), APPROVAL_NS.input, { type: 'number' }), '휴가', locked), null);
  assert.equal(sheetChangeBlock(s, setApprovalProp(s, one(1, 1), APPROVAL_NS.lock, true), '휴가', locked), null);
  // 금액 키 옮기기·떼기는 편집자 몫
  assert.equal(sheetChangeBlock(s, setCellName(s, 3, 3, 'amount'), '휴가', locked), null);
});

test('저장 검사 — 연동 기능 바뀜·잠긴 이름 사라짐·연동 이름 새로 생김을 막고, 행 넣기·금액 키·규칙 이름은 통과', () => {
  const s = base();
  const saved = { sheet: s, link: '휴가' };
  assert.deepEqual(saveLockIssues(saved, { sheet: s, link: '휴가' }), []);
  assert.equal(saveLockIssues(saved, { sheet: s, link: null }).length, 1);
  assert.equal(saveLockIssues(saved, { sheet: deleteRow(s, 1), link: '휴가' }).length, 1);
  assert.equal(saveLockIssues(saved, { sheet: setCellName(s, 0, 0, 'leaveType'), link: '휴가' }).length, 1);
  // 행 넣기로 칸이 옮겨져도 이름·칸 종류는 그대로
  const moved = setApprovalProp(setCellName(setCellName(s, 1, 1, undefined), 3, 1, 'period'), one(3, 1), APPROVAL_NS.input, { type: 'date' });
  assert.deepEqual(saveLockIssues(saved, { sheet: moved, link: '휴가' }), []);
  assert.deepEqual(saveLockIssues(saved, { sheet: setCellName(s, 2, 2, undefined), link: '휴가' }), []);
  // 규칙이 지어 붙인 이름 — 새로 생겨도, 규칙을 풀어 남아도 괜찮다
  const ruled = setRowCondition(setCellName(s, 0, 0, '조건칸'), 3, 3, { name: '조건칸', values: ['A'] });
  assert.deepEqual(saveLockIssues(saved, { sheet: ruled, link: '휴가' }), []);
  assert.deepEqual(saveLockIssues({ sheet: ruled, link: '휴가' }, { sheet: setRowCondition(ruled, 3, 3, undefined), link: '휴가' }), []);
  // 이름 없는 새 서식
  assert.deepEqual(saveLockIssues({ sheet: createSheet(2, 2), link: null }, { sheet: createSheet(3, 3), link: null }), []);
});

// ── 검토 반영 ──

test('[1] 규칙을 지우면 규칙이 지어 붙인 이름도 빠진다 — 행 보이기 조건·종속 선택 모두, 저장한 뒤에도', () => {
  const s = withSelect();
  const locked = lockedNamesOf(s);
  const { sheet: named, name } = ensureSourceName(s, 0, 0);
  // 규칙 걸기 — 이름은 그대로
  const shown = showRowsFor(named, 3, 3, name, '식대');
  assert.equal(nameAt(dropUnusedRuleNames(s, shown, locked), 0, 0), name);
  // 행 보이기 조건 빼기 → 이름도 빠짐
  const cleared = dropUnusedRuleNames(shown, removeRowsFor(shown, 3, 3, name, '식대'), locked);
  assert.equal(nameAt(cleared, 0, 0), undefined);
  // 조건 풀기(setRowCondition undefined)도 같다
  assert.equal(nameAt(dropUnusedRuleNames(shown, setRowCondition(shown, 3, 3, undefined), locked), 0, 0), undefined);
  // 종속 선택 풀기
  const dep = makeDependent(named, 3, 3, name);
  assert.equal(nameAt(dropUnusedRuleNames(dep, clearDependent(dep, 3, 3), locked), 0, 0), undefined);
  // 다른 규칙이 아직 가리키면 남는다
  const both = showRowsFor(shown, 2, 2, name, '교통');
  assert.equal(nameAt(dropUnusedRuleNames(both, removeRowsFor(both, 3, 3, name, '식대'), locked), 0, 0), name);
  // 규칙과 함께 저장한 판이 기준이어도(그 판에서 규칙이 가리키던 이름 — 잠기지 않음) 빠진다
  const savedLocked = lockedNamesOf(shown);
  assert.equal(isLockedName(savedLocked, name), false);
  assert.equal(nameAt(dropUnusedRuleNames(shown, removeRowsFor(shown, 3, 3, name, '식대'), savedLocked), 0, 0), undefined);
  // 이름이 빠진 시트는 저장해도 괜찮다
  assert.deepEqual(saveLockIssues({ sheet: shown, link: '휴가' }, { sheet: cleared, link: '휴가' }), []);
});

test('[1] 잠긴 이름(개발자가 붙인 이름)에 건 규칙을 지워도 이름은 남는다', () => {
  const s = setCellName(withSelect(), 0, 0, '품명');
  const locked = lockedNamesOf(s);
  const shown = showRowsFor(s, 3, 3, '품명', '식대');
  assert.equal(nameAt(dropUnusedRuleNames(shown, removeRowsFor(shown, 3, 3, '품명', '식대'), locked), 0, 0), '품명');
});

test('[2] 규칙 기준 칸이 든 행·열은 규칙 안내로 막고, 규칙을 지우면(이름도 빠져) 지울 수 있다', () => {
  const s = withSelect();
  const locked = lockedNamesOf(s);
  const { sheet: named, name } = ensureSourceName(s, 0, 0);
  const shown = showRowsFor(named, 3, 3, name, '식대');
  assert.match(deleteRowsBlock(shown, 0, 0, '휴가', locked) ?? '', /A1 칸\(.*\) 값에 따라 바뀌는 규칙이 있어요\. 규칙\('값에 따라 바뀌는 것'\)을 먼저 지우면 지울 수 있어요/);
  assert.match(deleteColsBlock(shown, 0, 0, '휴가', locked) ?? '', /값에 따라 바뀌는 규칙이 있어요/);
  // 잠긴 칸과 함께면 잠금 안내가 먼저
  assert.match(deleteRowsBlock(shown, 0, 1, '휴가', locked) ?? '', /'휴가 기간'.*지울 수 없어요/);
  const cleared = dropUnusedRuleNames(shown, removeRowsFor(shown, 3, 3, name, '식대'), locked);
  assert.equal(deleteRowsBlock(cleared, 0, 0, '휴가', locked), null);
  assert.equal(isStructureLocked(cleared, 'row', 0), false);
  // 규칙을 풀어 남은 이름(보이지 않는 이름)은 일반 편집자 행 지우기를 막지 않는다 — 개발자 기준(names 포함)은 그대로 막음
  const leftover = removeRowsFor(shown, 3, 3, name, '식대');
  assert.equal(deleteRowsBlock(leftover, 0, 0, '휴가', locked), null);
  assert.equal(isStructureLocked(leftover, 'row', 0, { names: false }), false);
  assert.equal(isStructureLocked(leftover, 'row', 0), true);
});

test('[3] 잠긴 칸에 규칙을 걸어도 잠금은 저장한 판 기준 — 칸 종류 바꾸기·가려지는 병합·저장이 막힌다', () => {
  // 개발자가 붙인 직접 쓴 이름 '품명'(A4 선택 칸) — 저장한 판에서 잠김
  let saved = setApprovalProp(base(), one(3, 0), APPROVAL_NS.input, { type: 'select', options: ['식대', '교통'] });
  saved = setCellName(saved, 3, 0, '품명');
  const locked = lockedNamesOf(saved);
  // 편집자가 그 칸에 행 보이기 조건을 건다 — 그래도 잠김(지금 시트의 규칙으로 잠금이 풀리지 않음)
  const ruled = showRowsFor(saved, 0, 0, '품명', '식대');
  assert.equal(isLockedName(locked, '품명'), true);
  assert.equal(isLockedName(lockedNamesOf(ruled), '품명'), false); // 지금 시트로 정했다면 풀렸을 것
  // 칸 종류 바꾸기
  const retyped = setApprovalProp(ruled, one(3, 0), APPROVAL_NS.input, { type: 'text' });
  assert.match(sheetChangeBlock(ruled, retyped, '휴가', locked) ?? '', /칸 종류를 바꿀 수 없어요/);
  // 덮는 병합 — A3 에 글자가 있으면 A3:A4 병합은 A4(품명)를 가린다
  const coverText = setCellValue(ruled, 2, 0, '머리');
  assert.match(mergeBlock(coverText, { r1: 2, c1: 0, r2: 3, c2: 0 }, '휴가', locked) ?? '', /가려지게 합칠 수 없어요/);
  // 규칙 기준 칸이어도 잠긴 칸이 든 행은 잠금 안내
  assert.match(deleteRowsBlock(ruled, 3, 3, '휴가', locked) ?? '', /A4 칸은 '품명'\(관련 문서 값 가져오기\)에 쓰여서 지울 수 없어요/);
  // 잠긴 직접 쓴 이름에 규칙을 거는 것 자체를 막는다 — 걸고 저장하면 다음부터 '규칙 이름'으로 보여 잠금이 풀리므로
  assert.match(sheetChangeBlock(saved, ruled, '휴가', locked) ?? '', /기준 칸으로 쓸 수 없어요/);
  // 저장 검사 — 종류가 바뀐 채로도, 규칙만 건 채로도 저장 안 됨(되돌리기 등 어느 길로 와도)
  const issues = saveLockIssues({ sheet: saved, link: '휴가' }, { sheet: retyped, link: '휴가' });
  assert.ok(issues.some((x) => /칸의 종류가 바뀌었어요/.test(x)));
  assert.match(saveLockIssues({ sheet: saved, link: '휴가' }, { sheet: ruled, link: '휴가' }).join(' '), /기준 칸으로 쓸 수 없어요/);
});

test('[3] 버전 되살리기 — 이름 개수가 같아도 잠긴 칸 종류가 다르면 막는다', () => {
  const saved = base();
  const oldVersion = setApprovalProp(saved, one(1, 1), APPROVAL_NS.input, { type: 'text' });
  assert.match(saveLockIssues({ sheet: saved, link: '휴가' }, { sheet: oldVersion, link: '휴가' }).join('\n'), /'휴가 기간'.*종류가 바뀌었어요/);
  // 금액 키 칸 종류가 달라도 괜찮다
  const amountRetyped = setApprovalProp(saved, one(2, 2), APPROVAL_NS.input, { type: 'number' });
  assert.deepEqual(saveLockIssues({ sheet: saved, link: '휴가' }, { sheet: amountRetyped, link: '휴가' }), []);
});
