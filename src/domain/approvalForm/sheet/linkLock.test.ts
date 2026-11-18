import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, deleteRow, setCellValue, type Sheet } from '@/lib/sheet/core';
import { APPROVAL_NS, mergeApprovalRange, setApprovalProp, setCellName, setRowCondition } from './approvalSheet';
import {
  deleteColsBlock,
  deleteRowsBlock,
  droppedLockedNames,
  isLockedName,
  lockInfo,
  lockTitle,
  lockedCells,
  mergeBlock,
  saveLockIssues,
  sheetChangeBlock,
} from './linkLock';

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

test('잠긴 이름 — 금액 키는 아니고, 연동 이름·직접 쓴 이름은 잠금', () => {
  const s = setCellName(base(), 0, 0, '품명');
  assert.equal(isLockedName(s, 'amount'), false);
  assert.equal(isLockedName(s, 'period'), true);
  assert.equal(isLockedName(s, '품명'), true);
  assert.deepEqual([...lockedCells(s).values()].sort(), ['period', '품명']);
});

test('잠긴 이름 — 규칙(행 보이기 조건)이 가리키는 직접 쓴 이름은 편집자 몫이라 안 잠금, 연동 이름은 그래도 잠금', () => {
  let s = setCellName(base(), 0, 0, '지출항목');
  s = setRowCondition(s, 3, 3, { name: '지출항목', values: ['식대'] });
  assert.equal(isLockedName(s, '지출항목'), false);
  s = setRowCondition(s, 3, 3, { name: 'period', values: ['x'] });
  assert.equal(isLockedName(s, 'period'), true);
});

test('표시 — 지금 연동 기능의 한글 이름과 기능, 직접 쓴 이름은 관련 문서 값 가져오기', () => {
  assert.deepEqual(lockInfo('period', '휴가'), { label: '휴가 기간', feature: '휴가 차감·근태·캘린더' });
  assert.deepEqual(lockInfo('period', '외근'), { label: '외근 일자', feature: '근태·캘린더' });
  assert.equal(lockTitle('품명', null), '품명 — 관련 문서 값 가져오기에 쓰여요');
});

test('행·열 지우기 — 잠긴 칸이 든 행·열만 막고, 금액 키 행·빈 행은 통과', () => {
  const s = base();
  assert.match(deleteRowsBlock(s, 0, 1, '휴가') ?? '', /2행의 칸은 '휴가 기간'\(휴가 차감·근태·캘린더\)에 쓰여서 지울 수 없어요/);
  assert.equal(deleteRowsBlock(s, 2, 3, '휴가'), null);
  assert.match(deleteColsBlock(s, 1, 1, '휴가') ?? '', /B2 칸/);
  assert.equal(deleteColsBlock(s, 2, 3, '휴가'), null);
});

test('병합 — 잠긴 칸이 가려지면 막고, 남는 칸이면 괜찮다(왼쪽 위가 비어 옮겨지는 경우 포함)', () => {
  let s = base();
  // A1 에 글자 — A1:B2 병합이면 B2(휴가 기간)가 가려진다
  const withText = setCellValue(s, 0, 0, '기간');
  assert.match(mergeBlock(withText, { r1: 0, c1: 0, r2: 1, c2: 1 }, '휴가') ?? '', /가려지게 합칠 수 없어요/);
  // 왼쪽 위가 빈 칸이면 B2 가 남는 칸 — 왼쪽 위로 옮겨져 이름이 산다
  assert.equal(mergeBlock(s, { r1: 0, c1: 0, r2: 1, c2: 1 }, '휴가'), null);
  const merged = mergeApprovalRange(s, { r1: 0, c1: 0, r2: 1, c2: 1 });
  assert.deepEqual(droppedLockedNames(s, merged), []);
  // 잠긴 칸이 왼쪽 위
  assert.equal(mergeBlock(s, { r1: 1, c1: 1, r2: 1, c2: 3 }, '휴가'), null);
  // 잠긴 칸 둘
  s = setCellName(s, 1, 2, 'leaveType');
  assert.match(mergeBlock(s, { r1: 1, c1: 1, r2: 1, c2: 2 }, '휴가') ?? '', /'휴가 기간'·'휴가 종류' 칸은 .*한 칸으로 합칠 수 없어요/);
});

test('편집자 동작 — 이름이 사라지거나 잠긴 칸의 입력 종류가 바뀌면 막고, 다른 칸·모양은 통과', () => {
  const s = base();
  assert.match(sheetChangeBlock(s, setCellName(s, 1, 1, undefined), '휴가') ?? '', /지울 수 없어요/);
  assert.match(sheetChangeBlock(s, setApprovalProp(s, one(1, 1), APPROVAL_NS.input, { type: 'text' }), '휴가') ?? '', /칸 종류를 바꿀 수 없어요/);
  assert.match(sheetChangeBlock(s, setApprovalProp(s, one(1, 1), APPROVAL_NS.input, undefined), '휴가') ?? '', /칸 종류를 바꿀 수 없어요/);
  assert.equal(sheetChangeBlock(s, setApprovalProp(s, one(0, 0), APPROVAL_NS.input, { type: 'text' }), '휴가'), null);
  assert.equal(sheetChangeBlock(s, setApprovalProp(s, one(2, 2), APPROVAL_NS.input, { type: 'number' }), '휴가'), null);
  assert.equal(sheetChangeBlock(s, setApprovalProp(s, one(1, 1), APPROVAL_NS.lock, true), '휴가'), null);
  // 금액 키 옮기기·떼기는 편집자 몫
  assert.equal(sheetChangeBlock(s, setCellName(s, 3, 3, 'amount'), '휴가'), null);
});

test('저장 검사 — 연동 기능 바뀜·잠긴 이름 사라짐·연동 이름 새로 생김을 막고, 행 넣기·금액 키·규칙 이름은 통과', () => {
  const s = base();
  const saved = { sheet: s, link: '휴가' };
  assert.deepEqual(saveLockIssues(saved, { sheet: s, link: '휴가' }), []);
  assert.equal(saveLockIssues(saved, { sheet: s, link: null }).length, 1);
  assert.equal(saveLockIssues(saved, { sheet: deleteRow(s, 1), link: '휴가' }).length, 1);
  assert.equal(saveLockIssues(saved, { sheet: setCellName(s, 0, 0, 'leaveType'), link: '휴가' }).length, 1);
  // 행 넣기로 칸이 옮겨져도 이름은 그대로
  const moved = setCellName(setCellName(s, 1, 1, undefined), 3, 1, 'period');
  assert.deepEqual(saveLockIssues(saved, { sheet: moved, link: '휴가' }), []);
  assert.deepEqual(saveLockIssues(saved, { sheet: setCellName(s, 2, 2, undefined), link: '휴가' }), []);
  // 규칙이 지어 붙인 이름 — 새로 생겨도, 규칙을 풀어 남아도 괜찮다
  const ruled = setRowCondition(setCellName(s, 0, 0, '조건칸'), 3, 3, { name: '조건칸', values: ['A'] });
  assert.deepEqual(saveLockIssues(saved, { sheet: ruled, link: '휴가' }), []);
  assert.deepEqual(saveLockIssues({ sheet: ruled, link: '휴가' }, { sheet: setRowCondition(ruled, 3, 3, undefined), link: '휴가' }), []);
  // 이름 없는 새 서식
  assert.deepEqual(saveLockIssues({ sheet: createSheet(2, 2), link: null }, { sheet: createSheet(3, 3), link: null }), []);
});
