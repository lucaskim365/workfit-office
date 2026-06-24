import { z } from 'zod';

/**
 * 장기재고/유효기간 agingStock. PK=lot. 조회전용.
 * 재고 보존 기한(Aging/Expiry) 추적용 조회 마스터.
 * (와이어프레임 wms-screens-3.jsx 의 인라인 mock 이관)
 */
export const agingStockSchema = z.object({
  /** Lot 번호 — PK. */
  lot: z.string().min(1, 'Lot 번호는 필수입니다'),
  /** 품목 코드. */
  code: z.string().min(1, '품목 코드는 필수입니다'),
  /** 품목명. */
  name: z.string().min(1, '품목명은 필수입니다'),
  /** 유효기한(YYYY-MM-DD). */
  expiry: z.string().min(1, '유효기한은 필수입니다'),
  /** 잔여/경과일(D-day) — number. */
  days: z.number(),
});

export type AgingStock = z.infer<typeof agingStockSchema>;
