import { z } from 'zod';

/**
 * 근태 근무 정책 도메인 스키마 (단일 진실 공급원).
 * 회사의 정규 출/퇴근 시간, 휴게시간, 지각/연장 판정 기준을 정의.
 */
export const commutePolicySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, '정책명을 입력하세요'),
  isDefault: z.boolean().default(true),
  /** 정규 출근 시각 (HH:mm) */
  workStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:mm 형식이어야 합니다').default('09:00'),
  /** 정규 퇴근 시각 (HH:mm) */
  workEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:mm 형식이어야 합니다').default('18:00'),
  /** 휴게(점심) 시작 시각 (HH:mm) */
  breakStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:mm 형식이어야 합니다').default('12:00'),
  /** 휴게(점심) 종료 시각 (HH:mm) */
  breakEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:mm 형식이어야 합니다').default('13:00'),
  /** 휴게 시간 (분 단위) */
  breakMin: z.number().int().min(0).default(60),
  /** 지각 유예 시간 (분 단위, 예: 0분 또는 5분) */
  lateGraceMin: z.number().int().min(0).default(0),
  /** 조기 출근 인정 시작 시각 (HH:mm) */
  earlyInLimitTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:mm 형식이어야 합니다').default('07:00'),
  /** 퇴근 후 몇 분부터 연장근로로 인정할지 (분 단위, 예: 10분) */
  overtimeStartMin: z.number().int().min(0).default(10),
  /** 야간 근로 시작 시각 (HH:mm) */
  nightStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:mm 형식이어야 합니다').default('22:00'),
  /** 야간 근로 종료 시각 (HH:mm) */
  nightEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:mm 형식이어야 합니다').default('06:00'),
  updatedAt: z.string().default(''),
  updatedBy: z.string().default('system'),
});

export type CommutePolicy = z.infer<typeof commutePolicySchema>;

export const DEFAULT_COMMUTE_POLICY: CommutePolicy = {
  id: 'DEFAULT',
  name: '전사 기본 근무제',
  isDefault: true,
  workStartTime: '09:00',
  workEndTime: '18:00',
  breakStartTime: '12:00',
  breakEndTime: '13:00',
  breakMin: 60,
  lateGraceMin: 0,
  earlyInLimitTime: '07:00',
  overtimeStartMin: 10,
  nightStartTime: '22:00',
  nightEndTime: '06:00',
  updatedAt: '2026-09-01T00:00:00+09:00',
  updatedBy: 'system',
};
