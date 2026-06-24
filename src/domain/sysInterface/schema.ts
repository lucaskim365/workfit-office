import { z } from 'zod';

/**
 * 외부 인터페이스 interfaces. PK=id. 조회전용.
 * 외부 시스템(ERP·PLC·WMS·검사장비) 연동 마스터 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 */
export const IF_TARGETS = ['ERP', 'PLC', 'WMS', 'EQ'] as const;
export const IF_STATUS = ['정상', '지연', '오류'] as const;

export const sysInterfaceSchema = z.object({
  /** 인터페이스 식별 코드(PK). 예: IF-ERP-001. */
  id: z.string().min(1, '인터페이스 ID는 필수입니다'),
  name: z.string().min(1, '인터페이스명은 필수입니다'),
  /** 연동 대상 시스템 분류. */
  target: z.enum(IF_TARGETS),
  /** 데이터 흐름 방향(송신·수신·양방향). */
  dir: z.string().default(''),
  /** 연동 주기(5분·실시간 등). */
  cycle: z.string().default(''),
  /** 최종 연동 시각(HH:MM:SS). */
  last: z.string().default(''),
  status: z.enum(IF_STATUS),
  /** 연동 주소(URL·OPC·Socket 등). */
  addr: z.string().default(''),
  /** 연동 방식(REST API·OPC UA·Socket 등). */
  method: z.string().default(''),
  remark: z.string().default(''),
});

export type SysInterface = z.infer<typeof sysInterfaceSchema>;
