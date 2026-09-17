import assert from 'node:assert';
import { evaluateCommuteRecord, type ApprovedLeaveInfo } from './engine';
import { DEFAULT_COMMUTE_POLICY } from '@/domain/commutePolicy/schema';
import { summarizeCommuteMonth } from './schema';

console.log('=== 근태 판정 엔진 (반차/반반차 연동) 단위 테스트 시작 ===\n');

const policy = {
  ...DEFAULT_COMMUTE_POLICY,
  workStartTime: '09:00',
  workEndTime: '18:00',
  breakStartTime: '12:00',
  breakEndTime: '13:00',
  breakMin: 60,
  lateGraceMin: 0,
};

// TEST-01: 오전반차 신청자가 12:55에 출근하여 18:00에 퇴근한 경우
{
  const leaveMap = new Map<string, ApprovedLeaveInfo>();
  leaveMap.set('2026-09-17', {
    leaveType: '오전반차',
    category: 'LEAVE',
    docTitle: '오전반차 신청',
  });

  const record = evaluateCommuteRecord(
    {
      empId: 1001,
      date: '2026-09-17',
      inAt: '2026-09-17T12:55:00',
      outAt: '2026-09-17T18:00:00',
    },
    policy,
    leaveMap,
  );

  assert.strictEqual(record.status, 'normal', '13:00 이전 출근이므로 지각이 아닌 normal이어야 함');
  assert.strictEqual(record.lateMin, 0, '오전반차 출근은 지각 0분이어야 함');
  assert.strictEqual(record.leaveName, '오전반차', 'leaveName이 오전반차로 보존되어야 함');
  assert(record.totalMin >= 480, `반차 240분 인정 가산으로 총 480분이어야 함 (실제: ${record.totalMin})`);
  console.log('✅ TEST-01 통과: 오전반차 13:00 이전 출근 정상 인정 및 4시간 가산');
}

// TEST-02: 오후반차 신청자가 09:00에 출근하고 13:00에 퇴근(태그 누락)한 경우
{
  const leaveMap = new Map<string, ApprovedLeaveInfo>();
  leaveMap.set('2026-09-17', {
    leaveType: '오후반차',
    category: 'LEAVE',
    docTitle: '오후반차 신청',
  });

  const record = evaluateCommuteRecord(
    {
      empId: 1002,
      date: '2026-09-17',
      inAt: '2026-09-17T09:00:00',
      outAt: null, // 퇴근 태그 미체크
    },
    policy,
    leaveMap,
  );

  assert.strictEqual(record.status, 'normal', '오후반차 승인자는 퇴근 태그 누락이라도 missing_out이 아닌 normal이어야 함');
  assert.strictEqual(record.totalMin, 480, '오후반차 인정으로 기본 480분 인정');
  console.log('✅ TEST-02 통과: 오후반차 퇴근 태그 미체크 보정 및 정상 출근 처리');
}

// TEST-03: summarizeCommuteMonth에서 반차(0.5일) 집계 확인
{
  const rows = [
    evaluateCommuteRecord(
      { empId: 1, date: '2026-09-01', inAt: '2026-09-01T13:00:00', outAt: '2026-09-01T18:00:00' },
      policy,
      new Map([['2026-09-01', { leaveType: '오전반차', category: 'LEAVE' }]]),
    ),
    evaluateCommuteRecord(
      { empId: 1, date: '2026-09-02', inAt: '2026-09-02T09:00:00', outAt: null },
      policy,
      new Map([['2026-09-02', { leaveType: '오후반차', category: 'LEAVE' }]]),
    ),
    evaluateCommuteRecord(
      { empId: 1, date: '2026-09-03', inAt: null, outAt: null },
      policy,
      new Map([['2026-09-03', { leaveType: '연차', category: 'LEAVE' }]]),
    ),
  ];

  const summary = summarizeCommuteMonth(rows);
  assert.strictEqual(summary.workDays, 2, '출근 일수는 2일');
  assert.strictEqual(summary.leaveDays, 2.0, '오전반차(0.5) + 오후반차(0.5) + 연차(1.0) = 2.0일');
  console.log('✅ TEST-03 통과: 월별 요약에서 반차(0.5일) 정밀 합산 정상');
}

console.log('\n🎉 근태 판정 엔진 모든 테스트 성공!');
