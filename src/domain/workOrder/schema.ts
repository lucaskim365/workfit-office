import { z } from 'zod';

/**
 * 작업지시(WorkOrder) 도메인 스키마 — 생산 트랜잭션.
 * 상태머신은 status.ts, 채번은 counters 채널 사용. ([[데이터_모델_설계서.md]] workOrders)
 */
export const WO_STATUS = ['대기', '발행', '진행', '완료', '지연'] as const;
export type WoStatus = (typeof WO_STATUS)[number];

export const workOrderSchema = z.object({
  no: z.string().min(1), // 지시번호(PK) WO-YYMMDD-NNN
  code: z.string().min(1), // 품목코드(FK→items)
  itemName: z.string().default(''),
  line: z.string().default(''),
  qty: z.number().int().nonnegative(),
  shift: z.string().default(''),
  status: z.enum(WO_STATUS).default('대기'),
  plannedDate: z.string().default(''),
  start: z.string().default(''),
  end: z.string().default(''),
});
export type WorkOrder = z.infer<typeof workOrderSchema>;

/** 신규 작성용(번호·상태 제외). */
export const workOrderDraftSchema = workOrderSchema.omit({ no: true, status: true, start: true, end: true });
export type WorkOrderDraft = z.infer<typeof workOrderDraftSchema>;
