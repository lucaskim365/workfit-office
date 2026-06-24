import { z } from 'zod';

/**
 * 품목(Item) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 */
export const ITEM_TYPES = ['원자재', '부자재', '반제품', '완제품'] as const;
export const ITEM_USE = ['사용', '미사용'] as const;

export const itemSchema = z.object({
  code: z.string().min(1, '품목코드는 필수입니다'),
  name: z.string().min(1, '품목명은 필수입니다'),
  spec: z.string().default(''),
  unit: z.string().default('EA'),
  type: z.enum(ITEM_TYPES),
  use: z.enum(ITEM_USE).default('사용'),
  /** 안전재고 수량(정수). RDB 친화 위해 숫자로 보관, 표시 단위는 unit. */
  safetyStock: z.number().int().nonnegative().default(0),
  remark: z.string().default(''),
});

export type Item = z.infer<typeof itemSchema>;

/** 신규 작성용(코드 외 선택 입력) — 부분 검증. */
export const itemDraftSchema = itemSchema.partial().extend({
  code: z.string().min(1, '품목코드는 필수입니다'),
  name: z.string().min(1, '품목명은 필수입니다'),
  type: z.enum(ITEM_TYPES),
});
export type ItemDraft = z.infer<typeof itemDraftSchema>;
