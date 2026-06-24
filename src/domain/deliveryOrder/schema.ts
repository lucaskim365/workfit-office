import { z } from 'zod';

/**
 * 자재 출하지시 deliveryOrders. PK=no. (영업 shipments와 별개)
 *
 * 단일 진실 공급원(SSOT) — 폼 검증·Firestore 검증·타입을 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다.
 */
export const DO_STATUS = ['출하대기', '상차중', '출하완료'] as const;

export const deliveryOrderSchema = z.object({
  /** 출하지시 번호(DO-) — PK. */
  no: z.string().min(1, '출하지시 번호는 필수입니다'),
  /** 연계 수주번호(salesOrders 참조). */
  so: z.string().min(1, '주문번호는 필수입니다'),
  /** 고객사명. */
  cust: z.string().min(1, '고객사는 필수입니다'),
  /** 출하 품목 코드. */
  code: z.string().min(1, '품목 코드는 필수입니다'),
  /** 출하 수량(표시용 문자열, 천단위 콤마 포함). */
  qty: z.string().default('0'),
  status: z.enum(DO_STATUS),
  /** 긴급 출하 여부(선택 행 강조). */
  urgent: z.boolean().optional(),
});

export type DeliveryOrder = z.infer<typeof deliveryOrderSchema>;
