import { z } from 'zod';

/**
 * 부재 및 대결자 설정(UserAbsenceConfig) 도메인 스키마.
 * 결재권자의 부재 기간(시작~종료), 대리 결재자(delegateUserId), 위임 범위 및 최고 허용 금액 설정 정보.
 */
export const userAbsenceSchema = z.object({
  /** 사용자 ID (users.id) */
  userId: z.string().min(1),
  /** 부재 활성화 여부 */
  isAbsent: z.boolean().default(false),
  /** 부재 시작 일시 (ISO string) */
  startDate: z.string().nullable().default(null),
  /** 부재 종료 일시 (ISO string) */
  endDate: z.string().nullable().default(null),
  /** 지정 대결자 ID (users.id) */
  delegateUserId: z.string().nullable().default(null),
  /** 부재 사유 (휴가, 출장, 병가 등) */
  reason: z.string().default(''),
  /** 대결 위임 범위 ('ALL' = 전체 문서, 'SPECIFIC_FORMS' = 특정 서식 한정) */
  scope: z.enum(['ALL', 'SPECIFIC_FORMS']).default('ALL'),
  /** 위임 허용 문서 서식 목록 (docType 배열) */
  allowedDocTypes: z.array(z.string()).default([]),
  /** 대결 승인 최고 허용 금액 제한 (원, null 또는 0 이면 제한 없음) */
  maxDelegateAmount: z.number().nullable().optional().default(null),
  /** 마지막 수정 일시 (ISO string) */
  updatedAt: z.string().nullable().default(null),
});

export type UserAbsenceConfig = z.infer<typeof userAbsenceSchema>;
