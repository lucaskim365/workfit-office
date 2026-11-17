import assert from 'node:assert/strict';
import test from 'node:test';
import { createSheet, setCellMeta } from '@/lib/sheet/core';
import { APPROVAL_NS, setCellName } from './approvalSheet';
import { leaveCellValues, leaveDocExtras, leaveFromValues } from './leaveSheet';
import type { LeaveDocValues } from '@/domain/leave/leavePicker';

const picked: LeaveDocValues = {
  leaveType: '오후반차',
  period: '2026-11-23',
  period__end: '2026-11-23',
  startTime: '13:30',
  endTime: '17:30',
  leaveUnit: '',
  quarterStart: '',
  days: 0.5,
};

test('시트 휴가원 — 휴가 기간이 기간 칸이면 시작 ~ 끝, 날짜 칸이면 시작일과 종료일 칸', () => {
  let range = createSheet(2, 2);
  range = setCellMeta(range, APPROVAL_NS.input, 0, 1, { type: 'dateRange' });
  range = setCellName(range, 0, 1, 'period');
  assert.deepEqual(leaveCellValues(range, { ...picked, period__end: '2026-11-25' }), {
    period: '2026-11-23 ~ 2026-11-25',
    leaveType: '오후반차',
    startTime: '13:30',
    endTime: '17:30',
  });

  let dates = createSheet(2, 2);
  dates = setCellMeta(dates, APPROVAL_NS.input, 0, 1, { type: 'date' });
  dates = setCellName(dates, 0, 1, 'period');
  dates = setCellMeta(dates, APPROVAL_NS.input, 1, 1, { type: 'date' });
  dates = setCellName(dates, 1, 1, 'period__end');
  const v = leaveCellValues(dates, { ...picked, period__end: '2026-11-25' });
  assert.equal(v.period, '2026-11-23');
  assert.equal(v.period__end, '2026-11-25');
});

test('시트 휴가원 — 문서 값은 기존 양식 휴가원과 같은 키로(반차 단위·반반차 시작·일수 포함)', () => {
  assert.deepEqual(leaveDocExtras({ ...picked, leaveType: '대체휴무', leaveUnit: '오후반차', days: 0.5 }), {
    leaveType: '대체휴무',
    period: '2026-11-23',
    period__end: '2026-11-23',
    period__days: '0.5',
    startTime: '13:30',
    endTime: '17:30',
    leaveUnit: '오후반차',
    quarterStart: '',
  });
});

test('시트 휴가원 — 고른 휴가를 문서 값에서 되살린다(다시 연 문서에서도 끝 날짜·일수·반차 단위가 지워지지 않게)', () => {
  const v = { ...picked, leaveType: '대체휴무', period__end: '2026-11-25', leaveUnit: '오후반차', days: 0.5 };
  assert.deepEqual(leaveFromValues(leaveDocExtras(v)), v);
  // 아직 안 고른 문서(휴가 종류나 시작일이 없음)
  assert.equal(leaveFromValues({ period: '2026-11-23' }), null);
  assert.equal(leaveFromValues({ leaveType: '연차' }), null);
  // 옛 문서 — 일수가 비어 있으면 0(다시 계산)
  assert.equal(leaveFromValues({ leaveType: '연차', period: '2026-11-23', period__days: '' })?.days, 0);
  assert.equal(leaveDocExtras({ ...picked, days: 0 }).period__days, '');
});
