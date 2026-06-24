import { z } from 'zod';

/**
 * 예비품 재고현황(SpareStock) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설계서 예비품 재고현황 spareStocks. PK=code. 조회전용.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 */
export const spareStockSchema = z.object({
  /** 품번(PK). */
  code: z.string().min(1, '품번은 필수입니다'),
  /** 품명. */
  name: z.string().min(1, '품명은 필수입니다'),
  /** 분류(소모성·정밀부품·전장부품·기구부품). */
  cat: z.string(),
  /** 보관 위치(랙 주소). */
  loc: z.string(),
  /** 보관 구역(창고). */
  wh: z.string(),
  /** 단위(EA·SET 등). */
  unit: z.string(),
  /** 단가(₩). */
  price: z.number(),
  /** 현재고 수량. */
  stock: z.number(),
  /** 안전재고 수량. */
  safe: z.number(),
  /** 적정재고 수량. */
  opt: z.number(),
  /** 재고 회전율. */
  turn: z.number(),
  /** 최종 입고일(MM-DD). */
  lastIn: z.string(),
  /** 최종 출고일(MM-DD). */
  lastOut: z.string(),
  /** 미사용(정체) 일수. */
  idle: z.number(),
  /** 재고 상태(정상·부족·주의·결품). */
  state: z.string(),
});

export type SpareStock = z.infer<typeof spareStockSchema>;
