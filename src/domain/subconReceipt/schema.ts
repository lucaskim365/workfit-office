import { z } from 'zod';

/**
 * 외주 입고 subconReceipts. PK=no. 조회전용.
 *
 * 외주 지시(미입고) 마스터 — 화면(subcon-receipt.jsx) 인라인 ORDERS 이관.
 * 입고 이력(TX)은 화면 상수로 유지하며 이 슬라이스는 지시/입고 진척만 다룬다.
 */
export const subconReceiptSchema = z.object({
  /** 외주 지시번호(SC-…). 문서 ID. */
  no: z.string().min(1, '외주 지시번호는 필수입니다'),
  vendor: z.string().min(1, '협력사는 필수입니다'),
  name: z.string().min(1, '품목명은 필수입니다'),
  /** 외주 공정명. */
  proc: z.string().default(''),
  /** 가공 단가(₩). */
  price: z.number(),
  /** 지시 수량(EA). */
  ordered: z.number(),
  /** 기입고 수량(EA). */
  received: z.number(),
});

export type SubconReceipt = z.infer<typeof subconReceiptSchema>;
