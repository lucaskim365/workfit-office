import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, setCellValue } from '@/lib/sheet/core';
import { APPROVAL_NS, PLACEHOLDER_MAX, requiredCells, setApprovalProp, titleDefaultOf, titleHintOf } from './approvalSheet';

const at = (r: number, c: number) => ({ r1: r, r2: r, c1: c, c2: c });

test('문서 제목 칸의 입력 예시 — 서식이 정한 글, 비우면 없음(작성 화면 기본 문구)', () => {
  let s = setApprovalProp(createSheet(2, 2), at(0, 1), APPROVAL_NS.bind, 'doc.title');
  assert.equal(titleHintOf(s, 0, 1), undefined);
  s = setApprovalProp(s, at(0, 1), APPROVAL_NS.titleHint, '  예: 11월 팀 회식비 정산 ');
  assert.equal(titleHintOf(s, 0, 1), '예: 11월 팀 회식비 정산');
  assert.equal(titleHintOf(setApprovalProp(s, at(0, 1), APPROVAL_NS.titleHint, 'ㄱ'.repeat(100)), 0, 1)?.length, PLACEHOLDER_MAX);
  assert.equal(titleHintOf(setApprovalProp(s, at(0, 1), APPROVAL_NS.titleHint, ''), 0, 1), undefined);
});

test('필수 칸 목록 — 채운 칸도 목록에 남고(별표), 비어 있는지만 달라진다', () => {
  let s = createSheet(2, 2);
  for (const r of [0, 1]) {
    s = setApprovalProp(s, at(r, 0), APPROVAL_NS.input, { type: 'text' });
    s = setApprovalProp(s, at(r, 0), APPROVAL_NS.required, true);
  }
  s = { ...s, rows: s.rows.map((row, r) => (r === 0 ? { ...row, [s.cols[0]]: '값' } : row)) };
  assert.deepEqual(requiredCells(s), [
    { r: 0, c: 0, missing: false },
    { r: 1, c: 0, missing: true },
  ]);
});

test('문서 제목 칸에 미리 적어 둔 글 — 제목 칸에 쓴 글자, 제목 칸이 없거나 비었으면 없음', () => {
  assert.equal(titleDefaultOf(setCellValue(createSheet(2, 2), 0, 1, '제목 아님')), '');
  const s = setApprovalProp(createSheet(2, 2), at(0, 1), APPROVAL_NS.bind, 'doc.title');
  assert.equal(titleDefaultOf(s), '');
  assert.equal(titleDefaultOf(setCellValue(s, 0, 1, ' 법인카드 사용 내역서 00월(1234/홍길동) ')), '법인카드 사용 내역서 00월(1234/홍길동)');
});
