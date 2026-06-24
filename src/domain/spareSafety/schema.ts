import { z } from 'zod';

/**
 * 설계서 예비품 안전재고 spareSafety. PK=code. 조회전용.
 *
 * 안전재고 미달 알림 조회 마스터 — 단일 진실 공급원(SSOT).
 * 화면 Row 인터페이스를 그대로 zod 스키마로 정의한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5: 스키마가 곧 테이블 DDL)
 */
export const spareSafetySchema = z.object({
  code: z.string().min(1, '예비품 코드는 필수입니다'),
  name: z.string().min(1, '예비품명은 필수입니다'),
  /** 분류(소모성·전장부품 등). */
  cat: z.string(),
  unit: z.string(),
  /** 단가(₩). */
  price: z.number(),
  /** 현재고 수량. */
  stock: z.number(),
  /** 안전재고 수량. */
  safe: z.number(),
  /** 적정재고 수량. */
  opt: z.number(),
  /** 리드타임(일). */
  lead: z.number(),
  /** 제조사. */
  maker: z.string(),
  /** 적용 설비 목록. */
  eqs: z.array(z.string()),
  /** 발주상태(미발주·발주중·입고예정). */
  po: z.string(),
  /** 최근 요청일. */
  lastReq: z.string(),
  /** 상태(결품·부족·주의·정상). */
  state: z.string(),
});

export type SpareSafety = z.infer<typeof spareSafetySchema>;
