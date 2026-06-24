import { z } from 'zod';

/**
 * 외주 발주(Subcontracting Order) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 컬렉션 `subconOrders`. 상태머신 지시→생산중→입고대기→완료. 채번 SC-YYMM-NNN.
 *
 * 협력사에 임가공을 의뢰한 외주 작업 지시(지급 자재 포함).
 */
export const SUBCON_ORDER_STATUS = ['지시', '생산중', '입고대기', '완료'] as const;
export const SUBCON_MAT_TYPE = ['무상', '유상'] as const;

export const subconOrderSchema = z.object({
  /** PK — SC-YYMM-NNN. */
  no: z.string().min(1),
  /** 협력사. */
  vendor: z.string().default(''),
  /** 임가공 공정. */
  proc: z.string().default(''),
  code: z.string().default(''),
  name: z.string().default(''),
  /** 지시 수량. */
  qty: z.number().nonnegative().default(0),
  unit: z.string().default('EA'),
  /** 가공 단가. */
  price: z.number().nonnegative().default(0),
  /** 납기(MM-DD). */
  due: z.string().default(''),
  /** 잔여 일수(D-day, 음수 가능). */
  dday: z.number().int().default(0),
  /** 지급 자재명. */
  mat: z.string().default(''),
  /** 지급 자재 구분(무상/유상). */
  matType: z.enum(SUBCON_MAT_TYPE),
  /** 지급 자재 출고 수량(표시 문자열). */
  matQty: z.string().default(''),
  status: z.enum(SUBCON_ORDER_STATUS).default('지시'),
});

export type SubconOrder = z.infer<typeof subconOrderSchema>;

/** 신규 발행용(번호·상태는 repo가 채움). */
export const subconOrderDraftSchema = subconOrderSchema.partial().extend({
  vendor: z.string().min(1, '협력사는 필수입니다'),
  proc: z.string().min(1, '임가공 공정은 필수입니다'),
  matType: z.enum(SUBCON_MAT_TYPE),
});
export type SubconOrderDraft = z.infer<typeof subconOrderDraftSchema>;
