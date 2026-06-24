import { z } from 'zod';

/**
 * 예비품(SparePart) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 2.4 예비품 spareParts. PK=code.
 */
export const sparePartSchema = z.object({
  code: z.string().min(1, '예비품 코드는 필수입니다'),
  name: z.string().min(1, '예비품명은 필수입니다'),
  /** 분류(소모성·정밀부품·전장부품·기구부품 등). */
  cat: z.string(),
  /** 규격/사양. */
  spec: z.string(),
  maker: z.string(),
  unit: z.string(),
  /** 단가(원). */
  price: z.number(),
  /** 리드타임(일). */
  lead: z.number(),
  /** 현재고. */
  stock: z.number(),
  /** 안전재고. */
  safe: z.number(),
  /** 적정재고. */
  opt: z.number(),
  /** 보관위치. */
  loc: z.string(),
  /** 보증기간. */
  warranty: z.string(),
  /** 대체품 코드 목록. */
  alt: z.array(z.string()).default([]),
  /** 적용 설비 목록. */
  eqs: z.array(z.string()).default([]),
  /** 재고 상태(정상·주의·부족·결품). */
  state: z.string(),
});

export type SparePart = z.infer<typeof sparePartSchema>;
