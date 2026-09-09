/**
 * 사내 휴가 유형 및 정책 카탈로그 (Leave Policy Catalog)
 *
 * 워크핏 그룹웨어의 표준 휴가 유형, 차감 일수, 기준 시간대를 정의합니다.
 * 표준 근무시간: 08:30 ~ 17:30 (점심시간 12:30 ~ 13:30)
 *
 * @see docs/연차휴가_산정_및_관리_정책_설계서.md §5
 */

export type LeaveCategory =
  | 'ANNUAL_DEDUCT'   // 법정 연차 원장에서 차감
  | 'SUBSTITUTE'      // 대체휴무 원장에서 차감
  | 'SPECIAL_PAID'    // 회사 복리후생 유급 (경조사, 포상 등)
  | 'SICK'            // 병가
  | 'UNPAID';         // 무급 휴직/휴가

export interface LeavePolicy {
  code: string;                 // 고유 코드 (예: 'ANNUAL', 'AM_HALF', 'PM_HALF')
  label: string;                // UI 노출명 (예: '오전 반차')
  displayDetail: string;        // 상세 설명 (예: '08:30 ~ 12:30 (0.5일)')
  category: LeaveCategory;
  deductsAnnualLeave: boolean;  // 연차 차감 대상 여부
  deductDays: number;           // 차감 일수 (1.0, 0.5, 0.25, 0.0)
  
  timeWindow?: {
    defaultStart: string;       // "08:30"
    defaultEnd: string;         // "12:30"
  };

  isHalfDay?: boolean;          // 반차 여부
  isQuarterDay?: boolean;       // 반반차 여부
  paid: boolean;                // 유급 여부
  requiresProof: boolean;       // 증빙 첨부 필수 여부
  guideMessage: string;         // 근태/복무 가이드 문구
}

export const LEAVE_POLICIES: Record<string, LeavePolicy> = {
  ANNUAL: {
    code: 'ANNUAL',
    label: '종일 연차',
    displayDetail: '전일 부재 (1.0일)',
    category: 'ANNUAL_DEDUCT',
    deductsAnnualLeave: true,
    deductDays: 1.0,
    timeWindow: {
      defaultStart: '08:30',
      defaultEnd: '17:30',
    },
    paid: true,
    requiresProof: false,
    guideMessage: '08:30~17:30 종일 부재 처리됩니다.',
  },

  AM_HALF: {
    code: 'AM_HALF',
    label: '오전 반차',
    displayDetail: '08:30 ~ 12:30 (0.5일)',
    category: 'ANNUAL_DEDUCT',
    deductsAnnualLeave: true,
    deductDays: 0.5,
    isHalfDay: true,
    timeWindow: {
      defaultStart: '08:30',
      defaultEnd: '12:30',
    },
    paid: true,
    requiresProof: false,
    guideMessage: '점심시간(12:30~13:30) 후 13:30에 정상 출근하여 근무합니다.',
  },

  PM_HALF: {
    code: 'PM_HALF',
    label: '오후 반차',
    displayDetail: '13:30 ~ 17:30 (0.5일)',
    category: 'ANNUAL_DEDUCT',
    deductsAnnualLeave: true,
    deductDays: 0.5,
    isHalfDay: true,
    timeWindow: {
      defaultStart: '13:30',
      defaultEnd: '17:30',
    },
    paid: true,
    requiresProof: false,
    guideMessage: '오전 근무 후 12:30 점심시간 시작과 함께 퇴근(조퇴)합니다.',
  },

  QUARTER: {
    code: 'QUARTER',
    label: '반반차',
    displayDetail: '2시간 지정 부재 (0.25일)',
    category: 'ANNUAL_DEDUCT',
    deductsAnnualLeave: true,
    deductDays: 0.25,
    isQuarterDay: true,
    timeWindow: {
      defaultStart: '15:30',
      defaultEnd: '17:30',
    },
    paid: true,
    requiresProof: false,
    guideMessage: '지정된 2시간 동안 부재 처리됩니다. (예: 조기퇴근 시 15:30~17:30)',
  },

  SUBSTITUTE: {
    code: 'SUBSTITUTE',
    label: '대체휴무',
    displayDetail: '대체휴무 원장 차감 (1.0일)',
    category: 'SUBSTITUTE',
    deductsAnnualLeave: false,
    deductDays: 1.0,
    paid: true,
    requiresProof: false,
    guideMessage: '휴일근무로 적립된 대체휴무 잔여에서 차감됩니다.',
  },

  EVENT: {
    code: 'EVENT',
    label: '경조사 휴가',
    displayDetail: '사내 규정 일수 (유급)',
    category: 'SPECIAL_PAID',
    deductsAnnualLeave: false,
    deductDays: 0.0,
    paid: true,
    requiresProof: true,
    guideMessage: '취업규칙상 경조사 유급휴가가 적용되며, 청첩장/부고 등 증빙이 필수입니다.',
  },

  SICK_PAID: {
    code: 'SICK_PAID',
    label: '유급 병가',
    displayDetail: '회사 지원 병가 (진단서 첨부)',
    category: 'SICK',
    deductsAnnualLeave: false,
    deductDays: 0.0,
    paid: true,
    requiresProof: true,
    guideMessage: '진단서 또는 진료확인서 첨부가 필수입니다.',
  },

  PUBLIC: {
    code: 'PUBLIC',
    label: '공가',
    displayDetail: '예비군/민방위/법원출석 등 (유급)',
    category: 'SPECIAL_PAID',
    deductsAnnualLeave: false,
    deductDays: 0.0,
    paid: true,
    requiresProof: true,
    guideMessage: '소환장 또는 참석 확인서 첨부가 필수입니다.',
  },
};

/** 휴가 종류 한글 라벨 맵핑 (기존 서식 및 신규 서식 호환) */
export const LEAVE_TYPE_OPTIONS = [
  { value: '연차', policyCode: 'ANNUAL', label: '종일 연차 (08:30~17:30 / 1.0일)', deductDays: 1.0 },
  { value: '오전반차', policyCode: 'AM_HALF', label: '오전 반차 (08:30~12:30 / 0.5일)', deductDays: 0.5 },
  { value: '오후반차', policyCode: 'PM_HALF', label: '오후 반차 (13:30~17:30 / 0.5일)', deductDays: 0.5 },
  { value: '반차', policyCode: 'AM_HALF', label: '반차 (구버전 호환 / 0.5일)', deductDays: 0.5 },
  { value: '반반차', policyCode: 'QUARTER', label: '반반차 (2시간 지정 / 0.25일)', deductDays: 0.25 },
  { value: '대체휴무', policyCode: 'SUBSTITUTE', label: '대체휴무 (휴일근무 적립분 차감)', deductDays: 1.0 },
  { value: '경조', policyCode: 'EVENT', label: '경조사 휴가 (증빙 필수)', deductDays: 0.0 },
  { value: '병가', policyCode: 'SICK_PAID', label: '병가 (진단서 필수)', deductDays: 0.0 },
  { value: '공가', policyCode: 'PUBLIC', label: '공가 (훈련/법원 등 증빙 필수)', deductDays: 0.0 },
  { value: '기타', policyCode: 'UNPAID', label: '기타 휴가', deductDays: 0.0 },
] as const;

/** 연차 차감 대상 여부 판정 */
export function isAnnualLeaveDeduction(leaveType: string): boolean {
  return ['연차', '오전반차', '오후반차', '반차', '반반차', 'ANNUAL', 'AM_HALF', 'PM_HALF', 'QUARTER'].includes(leaveType);
}

/** 휴가 유형별 기본 시간대 반환 */
export function getDefaultTimeWindow(leaveType: string): { startTime: string; endTime: string } {
  if (leaveType === '오전반차' || leaveType === 'AM_HALF') {
    return { startTime: '08:30', endTime: '12:30' };
  }
  if (leaveType === '오후반차' || leaveType === 'PM_HALF') {
    return { startTime: '13:30', endTime: '17:30' };
  }
  if (leaveType === '반반차' || leaveType === 'QUARTER') {
    return { startTime: '15:30', endTime: '17:30' };
  }
  return { startTime: '08:30', endTime: '17:30' };
}
