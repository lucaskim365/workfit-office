import {
  calculateEmploymentPeriod,
  calculateStatutoryEntitlement,
  evaluateAdvanceLeaveOffset,
  calculateFiscalYearEntitlement,
} from './accrualEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[Assertion Failed] ${message}`);
  }
}

function runTests() {
  console.log('=== 순수 연차 산정 엔진 단위 테스트 시작 ===\n');

  // TEST-01: 12/31 입사자 신정 연도 바뀜 오류 검증 (만 0년 판정)
  {
    const period = calculateEmploymentPeriod('2025-12-31', '2026-01-01');
    assert(period.fullYears === 0, 'TEST-01 Fail: 만 근속연수는 0년이어야 함');
    assert(period.daysWorked === 2, 'TEST-01 Fail: 재직일수는 2일이어야 함');
    
    const statutory = calculateStatutoryEntitlement('2025-12-31', '2026-01-01');
    assert(statutory.isUnderOneYear === true, 'TEST-01 Fail: 1년 미만자여야 함');
    assert(statutory.annualGrantDays === 0, 'TEST-01 Fail: 15일 연차 발생 금지');
    assert(statutory.totalStatutoryGranted === 0, 'TEST-01 Fail: 1일째는 0일 발생');
    console.log('✅ TEST-01 통과: 12/31 입사자 신정 연도 바뀜 오류 원천 방지');
  }

  // TEST-02: 1년 미만 신입사원 월별 1일 발생 누적 (만 2개월 만근 시 2일)
  {
    const statutory = calculateStatutoryEntitlement('2026-03-15', '2026-05-16');
    assert(statutory.isUnderOneYear === true, 'TEST-02 Fail: 1년 미만자여야 함');
    assert(statutory.monthlyAccruedTotal === 2, `TEST-02 Fail: 만 2개월 만근 시 2일이어야 함 (실제: ${statutory.monthlyAccruedTotal})`);
    assert(statutory.totalStatutoryGranted === 2, 'TEST-02 Fail: 총 부여 일수는 2일이어야 함');
    console.log('✅ TEST-02 통과: 1년 미만 신입사원 월별 1일 개근 누적 정상');
  }

  // TEST-03: 1년 미만 연차의 1년 시점 일괄 소멸 (2020년 개정법)
  {
    // 2025-03-01 입사자가 만 1년이 지난 2026-03-02에 조회 시 1년차 15일 부여 및 신입 월차 소멸
    const statutory = calculateStatutoryEntitlement('2025-03-01', '2026-03-02');
    assert(statutory.isUnderOneYear === false, 'TEST-03 Fail: 1년 이상 근로자여야 함');
    assert(statutory.annualGrantDays === 15, 'TEST-03 Fail: 1년 만근 시 15일 발생');
    assert(statutory.totalStatutoryGranted === 15, 'TEST-03 Fail: 1년 경과 시 기본 연차 15일만 유효');
    console.log('✅ TEST-03 통과: 1년 미만 월차 소멸 및 1년 이상 정기 15일 연차 부여');
  }

  // TEST-04: 만 3년 만근 가산연차 (+1일 -> 16일)
  {
    const statutory = calculateStatutoryEntitlement('2023-01-01', '2026-01-02');
    assert(statutory.seniorityYears === 3, 'TEST-04 Fail: 만 3년 근속이어야 함');
    assert(statutory.seniorityBonusDays === 1, 'TEST-04 Fail: 가산연차는 1일이어야 함');
    assert(statutory.annualGrantDays === 16, `TEST-04 Fail: 16일이어야 함 (실제: ${statutory.annualGrantDays})`);
    console.log('✅ TEST-04 통과: 만 3년 근속 가산연차 16일 정상');
  }

  // TEST-05: 법정 상한 한도 (25일 캡)
  {
    const statutory = calculateStatutoryEntitlement('2000-01-01', '2026-01-02');
    assert(statutory.seniorityYears === 26, 'TEST-05 Fail: 만 26년 근속');
    assert(statutory.annualGrantDays === 25, `TEST-05 Fail: 상한 25일 캡 적용되어야 함 (실제: ${statutory.annualGrantDays})`);
    console.log('✅ TEST-05 통과: 법정 25일 상한 캡 정상 작동');
  }

  // TEST-06: 홍채원 님 실사례 (2026-06-22 입사, 7월 하계휴가 5일 선사용, 9/9 기준 분석)
  {
    const offset = evaluateAdvanceLeaveOffset('2026-06-22', '2026-09-09', 5.0);
    assert(offset.totalUsed === 5.0, 'TEST-06 Fail: 총 사용 5일');
    assert(offset.currentAccrued === 2.0, `TEST-06 Fail: 9/9 기준 2개월 만근으로 2일 발생이어야 함 (실제: ${offset.currentAccrued})`);
    assert(offset.balance === -3.0, `TEST-06 Fail: 잔여는 -3일이어야 함 (실제: ${offset.balance})`);
    assert(offset.isAdvanceUsed === true, 'TEST-06 Fail: 선사용 상태로 판정되어야 함');
    assert(offset.offsetCompletedDays === 2.0, 'TEST-06 Fail: 2일 상계 완료');
    assert(offset.offsetRemainingDays === 3.0, 'TEST-06 Fail: 잔여 상계 3일');
    assert(offset.estimatedFullOffsetDate === '2026-11-22', `TEST-06 Fail: 완제 예상일은 2026-11-22여야 함 (실제: ${offset.estimatedFullOffsetDate})`);
    console.log('✅ TEST-06 통과: 홍채원 님 선사용 5일 및 월별 상계 분석 완벽 일치 (11/22 완제 예상)');
  }

  // TEST-07: 대법원 2021다227100 판례 (365일 퇴직 vs 366일 재직)
  {
    // 2025-01-01 입사, 2025-12-31 퇴직 (정확히 365일 근무 후 계약종료)
    const period365 = calculateEmploymentPeriod('2025-01-01', '2025-12-31');
    assert(period365.daysWorked === 365, 'TEST-07 Fail: 365일 재직');
    assert(period365.hasRetainedOnDay366 === false, 'TEST-07 Fail: 366일 유지 미충족');

    const statutory365 = calculateStatutoryEntitlement('2025-01-01', '2025-12-31');
    assert(statutory365.annualGrantDays === 0, 'TEST-07 Fail: 365일 근무 종료 시 15일 미발생 판정 필수');

    // 2025-01-01 입사, 2026-01-01 재직 (366일째 도래)
    const period366 = calculateEmploymentPeriod('2025-01-01', '2026-01-01');
    assert(period366.daysWorked === 366, 'TEST-07 Fail: 366일 재직');
    assert(period366.hasRetainedOnDay366 === true, 'TEST-07 Fail: 366일 유지 충족');

    const statutory366 = calculateStatutoryEntitlement('2025-01-01', '2026-01-01');
    assert(statutory366.annualGrantDays === 15, 'TEST-07 Fail: 366일 도래 시 15일 발생');
    console.log('✅ TEST-07 통과: 대법원 판례(365일 vs 366일 재직) 엄격 구분');
  }

  // TEST-08: 회계연도 1월 1일 중도입사자 비례 연차
  {
    // 2025-07-01 입사자의 2026년 회계연도 비례연차 (2025-07-01 ~ 2025-12-31: 184일)
    // 15 * (184 / 365) = 7.5616... -> 7.6일
    const fiscal = calculateFiscalYearEntitlement('2025-07-01', 2026);
    assert(fiscal.daysWorkedInPrevYear === 184, `TEST-08 Fail: 184일이어야 함 (실제: ${fiscal.daysWorkedInPrevYear})`);
    assert(fiscal.proRataGrantDays === 7.6, `TEST-08 Fail: 비례연차는 7.6일이어야 함 (실제: ${fiscal.proRataGrantDays})`);
    console.log('✅ TEST-08 통과: 회계연도 1/1 중도입사자 비례연차 정상 산출 (7.6일)');
  }

  console.log('\n🎉 모든 8대 단위 테스트를 성공적으로 통과했습니다!');
}

runTests();
