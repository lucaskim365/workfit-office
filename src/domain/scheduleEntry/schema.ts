import { z } from 'zod';

/**
 * 생산 일정 scheduleEntries. PK=wo. 조회전용.
 *
 * 일일 생산 스케줄링 화면의 미배정 WO 일정 1건 = 1 도큐먼트.
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다.
 */
export const scheduleEntrySchema = z.object({
  /** 작업지시 번호(PK). */
  wo: z.string().min(1, '작업지시 번호는 필수입니다'),
  /** 생산 품목명. */
  prod: z.string().min(1, '품목명은 필수입니다'),
  /** 계획 수량(EA). */
  qty: z.number().nonnegative(),
  /** 납기 표기(예: D-1). */
  due: z.string().default(''),
  /** 긴급 여부. */
  urgent: z.boolean().default(false),
});

export type ScheduleEntry = z.infer<typeof scheduleEntrySchema>;
