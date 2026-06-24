import { z } from 'zod';

/**
 * 예비품 입출고 원장(SpareMovement) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 예비품 입출고원장 spareMovements. PK=no.
 * 입출고 트랜잭션 1건 = 1 도큐먼트(원장 리스트, 상태머신 없음).
 */
export const spareMovementSchema = z.object({
  /** 전표번호(PK). */
  no: z.string().min(1, '전표번호는 필수입니다'),
  /** 입고/출고 등 처리 구분. */
  type: z.string().min(1, '구분은 필수입니다'),
  /** 처리 일시(MM-DD HH:mm). */
  date: z.string().default(''),
  /** 예비품 코드(spareParts 참조). */
  code: z.string().default(''),
  /** 예비품명. */
  name: z.string().default(''),
  /** 처리 수량. */
  qty: z.number().default(0),
  /** 단위. */
  unit: z.string().default('EA'),
  /** 입출고 후 재고. */
  after: z.number().default(0),
  /** 사유. */
  reason: z.string().default(''),
  /** 처리자. */
  who: z.string().default(''),
  /** 참조(공급처·대상 설비 등). */
  ref: z.string().default(''),
});

export type SpareMovement = z.infer<typeof spareMovementSchema>;
