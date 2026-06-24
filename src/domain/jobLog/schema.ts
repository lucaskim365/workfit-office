import { z } from 'zod';

/**
 * 작업 시작/종료 로그 jobLogs. PK=no.
 * 작업자가 작업지시(WO)를 개시·종료한 기록 마스터.
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5: 이 정의가 곧 테이블 DDL)
 */
export const JOB_LOG_STATUS = ['진행중', '완료', '대기'] as const;

export const jobLogSchema = z.object({
  /** 작업지시번호(PK). WO-YYMMDD-NNN. */
  no: z.string().min(1, '지시번호는 필수입니다'),
  /** 품목 코드. */
  code: z.string().min(1, '품목 코드는 필수입니다'),
  /** 공정(예: OP-30 식각). */
  proc: z.string().min(1, '공정은 필수입니다'),
  status: z.enum(JOB_LOG_STATUS),
  /** 시작 시각(HH:MM). 미시작이면 '—'. */
  start: z.string().default('—'),
  /** 종료 시각(HH:MM). 미종료이면 '—'. */
  end: z.string().default('—'),
});

export type JobLog = z.infer<typeof jobLogSchema>;
