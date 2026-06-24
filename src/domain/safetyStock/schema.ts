import { z } from 'zod';

/**
 * 자재 안전재고 safetyStock. PK=code. 조회전용.
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 와이어프레임 wms-screens-4.jsx 의 인라인 튜플(ROWS) 정본.
 */
export const SS_STATUS = ['정상', '미달', '발주필요'] as const;

export const safetyStockSchema = z.object({
  /** 품목코드(PK). */
  code: z.string().min(1, '품목코드는 필수입니다'),
  /** 품명. */
  name: z.string().min(1, '품명은 필수입니다'),
  /** 현재고. */
  current: z.number(),
  /** 안전재고(Min). */
  safety: z.number(),
  /** 최대재고(Max). */
  max: z.number(),
  /** 발주점(ROP). */
  reorder: z.number(),
  /** 발주량(EOQ) — 적정 발주량. */
  optimal: z.number(),
  /** 재고 상태 — 정상·미달·발주필요. */
  status: z.enum(SS_STATUS),
});

export type SafetyStock = z.infer<typeof safetyStockSchema>;
