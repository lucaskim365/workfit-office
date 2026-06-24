import { z } from 'zod';

/**
 * 생산실적(ProductionResult) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 생산실적 `productionResults`. PK=no(작업지시번호).
 * 로그 마스터 — 작업지시별 생산실적을 누적 기록한다.
 */
/** 실적 집계 방식 — PLC 자동집계 vs 작업자 수기입력. */
export const PR_AGG = ['자동(PLC)', '수기'] as const;

export const productionResultSchema = z.object({
  /** 작업지시번호(WO-) — 문서 PK. */
  no: z.string().min(1, '작업지시번호는 필수입니다'),
  /** 생산 품목 코드. */
  code: z.string().min(1, '품목 코드는 필수입니다'),
  /** 지시 수량(표시용 포맷 문자열, 천단위 구분). */
  order: z.string().default('0'),
  /** 양품 수량. */
  good: z.string().default('0'),
  /** 불량 수량. */
  bad: z.string().default('0'),
  /** 주요 불량코드(defectCodes 참조). */
  defect: z.string().default(''),
  /** 집계 방식. */
  agg: z.enum(PR_AGG),
});

export type ProductionResult = z.infer<typeof productionResultSchema>;
