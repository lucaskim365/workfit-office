import { z } from 'zod';

/**
 * 거래처(Vendor) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설계서상 거래처/협력사/고객을 통합한 마스터. ([[데이터_모델_설계서.md]] §1)
 * 현재 화면이 쓰는 type(매입|매출|외주) 기준. 보전/부품/교정 등은 확장 시 추가.
 */
export const VENDOR_TYPES = ['매입', '매출', '외주'] as const;
export const VENDOR_USE = ['사용', '미사용'] as const;
export const VENDOR_GRADES = ['A', 'B', 'C'] as const;

export const vendorSchema = z.object({
  code: z.string().min(1, '거래처코드는 필수입니다'),
  name: z.string().min(1, '거래처명은 필수입니다'),
  type: z.enum(VENDOR_TYPES),
  use: z.enum(VENDOR_USE).default('사용'),
  bizNo: z.string().default(''),
  ceo: z.string().default(''),
  manager: z.string().default(''),
  addr: z.string().default(''),
  /** 매출 거래처 전용(선택) — 여신한도·등급. ([[데이터_모델_설계서.md]] vendors) */
  creditLimit: z.number().int().nonnegative().optional(),
  grade: z.enum(VENDOR_GRADES).optional(),
});

export type Vendor = z.infer<typeof vendorSchema>;
