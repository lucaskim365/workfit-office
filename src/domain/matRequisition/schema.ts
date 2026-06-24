import { z } from 'zod';

/**
 * 자재 청구 matRequisitions. PK=no.
 * 현장 라인 → 창고 자재 청구/요청(BOM 소요량 기준)의 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * ⚠ 생산 모듈 materialRequests 와는 별개 컬렉션이다.
 */
export const MR_STATUS = ['승인', '대기'] as const;

export const matRequisitionSchema = z.object({
  /** 청구번호(PK). 채번 MR-YYMMDD-NN. */
  no: z.string().min(1, '청구번호는 필수입니다'),
  /** 연계 작업지시 번호. */
  wo: z.string().min(1, '작업지시는 필수입니다'),
  /** 청구 품목 코드. */
  code: z.string().min(1, '품목 코드는 필수입니다'),
  /** 요청 라인. */
  line: z.string().min(1, '요청 라인은 필수입니다'),
  /** 소요량(천 단위 구분 문자열 표시 그대로). */
  qty: z.string().default(''),
  /** 청구 상태 — 승인/대기. */
  status: z.enum(MR_STATUS),
  /** 긴급 표시 여부(선택). */
  urgent: z.boolean().optional(),
});

export type MatRequisition = z.infer<typeof matRequisitionSchema>;
