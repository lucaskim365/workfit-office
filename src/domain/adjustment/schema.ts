import { z } from 'zod';

/**
 * 재고 조정 adjustments. PK=no.
 *
 * 전산-실물 차이 보정(Stock Adjustment) 로그 마스터.
 * (와이어프레임 wms-screens-3.jsx 의 인라인 ROWS 이관)
 */
export const ADJ_STATUS = ['승인완료', '승인대기'] as const;

export const adjustmentSchema = z.object({
  /** 조정번호(PK). 채번 ADJ-YYMMDD-NN. */
  no: z.string().min(1, '조정번호는 필수입니다'),
  /** 품목 코드. */
  code: z.string().min(1, '품목 코드는 필수입니다'),
  /** 보관 위치(로케이션). */
  loc: z.string().min(1, '위치는 필수입니다'),
  /** 조정 수량 — 부호 포함 문자열('-15','+2'). */
  qty: z.string().min(1, '조정수량은 필수입니다'),
  /** 조정 사유. */
  reason: z.string().default(''),
  status: z.enum(ADJ_STATUS).default('승인대기'),
  /** 선택(강조) 행 여부. */
  urgent: z.boolean().optional(),
});

export type Adjustment = z.infer<typeof adjustmentSchema>;
