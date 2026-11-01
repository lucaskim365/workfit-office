import assert from 'node:assert/strict';
import test from 'node:test';
import { clockOf, markOvertimeTimes, overtimeFillOf, overtimeHours, workKindOf } from './overtimeDraft';

const policy = { workEndTime: '18:00', breakStartTime: '12:00', breakEndTime: '13:00', overtimeStartMin: 10 };

test('시각은 한국 시각으로 읽고 표시가 붙어 있어도 읽는다', () => {
  assert.equal(clockOf('2026-10-30T08:40:00+09:00'), '08:40');
  assert.equal(clockOf('2026-10-29T23:40:00.000Z'), '08:40');
  assert.equal(clockOf('9:05'), '09:05');
  assert.equal(clockOf('19:30 (예정)'), '19:30');
  assert.equal(clockOf(''), '');
  assert.equal(clockOf(null), '');
  assert.equal(clockOf('25:00'), '');
  assert.equal(clockOf('모름'), '');
});

test('주말·공휴일은 휴일, 평일은 연장', () => {
  assert.equal(workKindOf('2026-10-31'), '휴일'); // 토
  assert.equal(workKindOf('2026-11-01'), '휴일'); // 일
  assert.equal(workKindOf('2026-10-30'), '연장'); // 금
  assert.equal(workKindOf('2026-10-30', '임시공휴일'), '휴일');
});

test('지난 날 기록이 다 있으면 표시 없이 채운다', () => {
  const f = overtimeFillOf('2026-10-29', '2026-11-01', { inAt: '2026-10-29T09:00:00+09:00', outAt: '2026-10-29T20:30:00+09:00' });
  assert.deepEqual(f, { workKind: '연장', workStart: '09:00', workEnd: '20:30', marks: {} });
});

test('오늘 퇴근 전이면 출근만 채우고 퇴근은 예정', () => {
  const f = overtimeFillOf('2026-10-30', '2026-10-30', { inAt: '2026-10-30T09:00:00+09:00', outAt: null });
  assert.equal(f.workStart, '09:00');
  assert.equal(f.workEnd, '');
  assert.deepEqual(f.marks, { workEnd: '예정' });
});

test('앞으로의 날짜는 둘 다 예정, 지난 날 기록이 없으면 둘 다 수동 입력', () => {
  assert.deepEqual(overtimeFillOf('2026-11-05', '2026-11-01', null).marks, { workStart: '예정', workEnd: '예정' });
  assert.deepEqual(overtimeFillOf('2026-10-20', '2026-11-01', null).marks, { workStart: '수동 입력', workEnd: '수동 입력' });
});

test('평일은 정규 퇴근 이후만 센다', () => {
  assert.equal(overtimeHours('연장', '09:00', '20:30', policy), 2.5);
  assert.equal(overtimeHours('야간', '09:00', '23:00', policy), 5);
  assert.equal(overtimeHours('연장', '09:00', '18:05', policy), 0); // 인정 시작 10분 미만
  assert.equal(overtimeHours('연장', '09:00', '17:00', policy), 0);
});

test('휴일은 휴게시간과 겹친 만큼만 뺀다', () => {
  assert.equal(overtimeHours('휴일', '09:00', '18:00', policy), 8);
  assert.equal(overtimeHours('휴일', '13:00', '17:00', policy), 4);
  assert.equal(overtimeHours('휴일', '12:30', '14:00', policy), 1);
});

test('자정을 넘긴 퇴근', () => {
  assert.equal(overtimeHours('연장', '09:00', '01:00', policy), 7);
});

test('시각이 비면 계산하지 않는다', () => {
  assert.equal(overtimeHours('연장', '09:00', '', policy), null);
});

test('상신 값에 표시를 붙이고, 기록과 다르게 고치면 수동 입력', () => {
  const fill = overtimeFillOf('2026-10-30', '2026-10-30', { inAt: '2026-10-30T09:00:00+09:00', outAt: null });
  assert.deepEqual(markOvertimeTimes({ workStart: '09:00', workEnd: '20:00' }, fill), { workStart: '09:00', workEnd: '20:00 (예정)' });
  assert.deepEqual(markOvertimeTimes({ workStart: '08:00', workEnd: '20:00' }, fill), { workStart: '08:00 (수동 입력)', workEnd: '20:00 (예정)' });
});

test('표시가 이미 붙은 값을 다시 상신해도 겹치지 않는다', () => {
  const fill = overtimeFillOf('2026-10-30', '2026-10-30', { inAt: '2026-10-30T09:00:00+09:00', outAt: null });
  assert.equal(markOvertimeTimes({ workStart: '09:00', workEnd: '20:00 (예정)' }, fill).workEnd, '20:00 (예정)');
});
