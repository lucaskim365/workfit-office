import { z } from 'zod';

/**
 * 시스템 로그 systemLogs. PK=id. 조회전용.
 * 접속·변경 이력을 기록하는 로그 마스터.
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5: 스키마 = 테이블 DDL)
 */
export const SYSTEM_LOG_TYPES = ['접속', '변경'] as const;

export const systemLogSchema = z.object({
  /** 로그 식별자(PK). 결정적 부여 LOG-01~. */
  id: z.string().min(1, '로그 ID는 필수입니다'),
  /** 발생 일시(YYYY-MM-DD HH:mm:ss). */
  at: z.string().min(1),
  /** 사용자(사번 성명). */
  user: z.string().min(1),
  /** 로그 유형 — 접속·변경. */
  type: z.enum(SYSTEM_LOG_TYPES),
  /** 대상 화면. */
  screen: z.string().default(''),
  /** 상세 내용. */
  detail: z.string().default(''),
  /** 접속 IP. */
  ip: z.string().default(''),
});

export type SystemLog = z.infer<typeof systemLogSchema>;
