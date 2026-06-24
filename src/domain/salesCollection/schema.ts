import { z } from 'zod';

/**
 * 수금 salesCollections. PK=no.
 * 입금 등록 → 세금계산서(채권) 매칭 로그 마스터.
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다.
 */
export const salesCollectionSchema = z.object({
  /** 수금번호(PK). 예: RC-2606-055 */
  no: z.string().min(1, '수금번호는 필수입니다'),
  /** 거래처. */
  cust: z.string().min(1, '거래처는 필수입니다'),
  /** 수금일(YYYY-MM-DD). */
  date: z.string().min(1, '수금일은 필수입니다'),
  /** 수금방법 — 계좌이체/어음/카드 등. */
  method: z.string().min(1, '수금방법은 필수입니다'),
  /** 수금액(원). */
  amt: z.number(),
  /** 연계 매칭 증빙(세금계산서 번호 또는 선입금 등). */
  doc: z.string().default(''),
  /** 매칭 상태 — 소진/미소진 등. */
  match: z.string().default(''),
});

export type SalesCollection = z.infer<typeof salesCollectionSchema>;
