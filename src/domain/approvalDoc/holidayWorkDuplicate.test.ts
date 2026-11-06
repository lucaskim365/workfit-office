import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findHolidayWorkDuplicate } from './holidayWorkDuplicate';

const doc = (over: Record<string, unknown>) => ({
  id: 'D-new',
  docType: '휴일근무',
  drafterId: 'U1',
  status: '임시저장',
  fieldValues: { workDate: '2026-11-01' },
  ...over,
});

test('같은 사람·같은 날 결재 중이거나 끝난 휴일근로가 있으면 중복', () => {
  for (const status of ['진행중', '완료']) {
    assert.ok(findHolidayWorkDuplicate(doc({}), [doc({ id: 'D-old', status })]));
  }
  // 예전 서식 코드(연장근로)도 같은 신청서
  assert.ok(findHolidayWorkDuplicate(doc({}), [doc({ id: 'D-old', status: '완료', docType: '연장근로' })]));
});

test('반려·회수·취소·임시저장·삭제된 문서는 세지 않는다 — 다시 낼 수 있게', () => {
  for (const status of ['반려', '회수', '취소완료', '임시저장', '삭제']) {
    assert.equal(findHolidayWorkDuplicate(doc({}), [doc({ id: 'D-old', status })]), null);
  }
});

test('다른 날·다른 사람·자기 자신·다른 서식은 중복 아님', () => {
  assert.equal(findHolidayWorkDuplicate(doc({}), [doc({ id: 'D-old', status: '완료', fieldValues: { workDate: '2026-11-02' } })]), null);
  assert.equal(findHolidayWorkDuplicate(doc({}), [doc({ id: 'D-old', status: '완료', drafterId: 'U2' })]), null);
  assert.equal(findHolidayWorkDuplicate(doc({ status: '진행중' }), [doc({ status: '진행중' })]), null);
  assert.equal(findHolidayWorkDuplicate(doc({}), [doc({ id: 'D-old', status: '완료', docType: '휴가' })]), null);
  assert.equal(findHolidayWorkDuplicate(doc({ docType: '휴가' }), [doc({ id: 'D-old', status: '완료' })]), null);
});
