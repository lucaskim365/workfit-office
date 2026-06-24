import { z } from 'zod';

/**
 * 재고 실사 countRecords. PK=id. 조회전용.
 * 전산(장부)재고 vs 실물(실사)재고 대조 결과 1행 = 1 도큐먼트.
 * 미실사 행은 actual='미실사', diff='—' 처럼 문자열로 표시값을 그대로 보존한다.
 */
export const COUNT_RESULT = ['일치', '차이', '대기'] as const;

export const countRecordSchema = z.object({
  /** 결정적 PK(CNT-01~). */
  id: z.string().min(1),
  /** 품목 코드. */
  code: z.string().min(1),
  /** 보관 위치(로케이션). */
  loc: z.string().min(1),
  /** 장부(전산)재고 — 표시 문자열(천단위 콤마 포함). */
  book: z.string(),
  /** 실사재고 — 표시 문자열. 미실사 시 '미실사'. */
  actual: z.string(),
  /** 차이 — 표시 문자열(+/-/0/—). */
  diff: z.string(),
  /** 판정 결과 — 일치/차이/대기. */
  result: z.enum(COUNT_RESULT),
});

export type CountRecord = z.infer<typeof countRecordSchema>;
