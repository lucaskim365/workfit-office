import { z } from 'zod';

/**
 * 외주 보유재고 subconStocks. PK=name. 조회전용.
 * 외주처(업체)가 보유한 외주 재고 현황 마스터. 단일 진실 공급원(SSOT).
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5: 이 스키마가 곧 테이블 DDL)
 */
export const subconStockSchema = z.object({
  /** 업체명 — PK(문서 ID). */
  name: z.string().min(1, '업체명은 필수입니다'),
  /** 대표 보유 품목 표기 문구. */
  item: z.string().default(''),
  /** 지급수량. */
  issued: z.number(),
  /** 투입(사용) 수량. */
  used: z.number(),
  /** 반품 수량. */
  ret: z.number(),
  /** 카드 색상(리터럴 hex 문자열 보존). */
  c: z.string(),
});

export type SubconStock = z.infer<typeof subconStockSchema>;
