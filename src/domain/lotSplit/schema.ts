import { z } from 'zod';

/**
 * LOT 분할/병합 이력 lotSplits. PK=id.
 * 로그 마스터(append-only 처리 이력) — 1 처리 = 1 도큐먼트.
 * 화면(wms-screens-4.jsx) HIST 테이블 헤더를 객체 필드로 옮긴 단일 진실 공급원(SSOT).
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다.
 */
export const LS_TYPES = ['분할', '병합'] as const;

export const lotSplitSchema = z.object({
  /** 처리번호 — PK. (SP-…/MG-… 채번) */
  id: z.string().min(1, '처리번호는 필수입니다'),
  /** 처리 유형 — 분할(Split) / 병합(Merge). */
  type: z.enum(LS_TYPES),
  /** 원 Lot — 분할 시 단일 Lot, 병합 시 복수 Lot 표기. */
  srcLot: z.string().min(1),
  /** 결과 Lot — 처리 후 생성/통합된 Lot 표기. */
  resultLots: z.string().min(1),
  /** 수량 변화 — 예: '500 → 200·200·100'. */
  qty: z.string().default(''),
  /** 작업자. */
  who: z.string().default(''),
  /** 처리 일시(MM-DD HH:mm). */
  date: z.string().default(''),
});

export type LotSplit = z.infer<typeof lotSplitSchema>;
