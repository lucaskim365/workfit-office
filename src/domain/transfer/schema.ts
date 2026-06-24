import { z } from 'zod';

/**
 * 재고 이송(Transfer) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 재고 이송 transfers. PK=no.
 * 창고/위치 간 내부 이송 1건 = 도큐먼트 1건.
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5: 이 정의가 곧 테이블 DDL)
 */
export const TRANSFER_STATUS = ['진행', '완료', '취소'] as const;

export const transferSchema = z.object({
  /** 이송번호(PK). 채번 TR-YYMMDD-NN. */
  no: z.string().min(1, '이송번호는 필수입니다'),
  /** 품목 코드. */
  code: z.string().min(1, '품목 코드는 필수입니다'),
  /** 출발 위치. */
  from: z.string().min(1, '출발 위치는 필수입니다'),
  /** 도착 위치. */
  to: z.string().min(1, '도착 위치는 필수입니다'),
  /** 이송 수량. */
  qty: z.string().default('0'),
  /** 이송 상태 — 진행·완료·취소. */
  status: z.enum(TRANSFER_STATUS),
  /** 긴급/선택 강조 플래그(선택). */
  urgent: z.boolean().optional(),
});

export type Transfer = z.infer<typeof transferSchema>;
