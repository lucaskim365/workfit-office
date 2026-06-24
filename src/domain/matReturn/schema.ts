import { z } from 'zod';

/**
 * 자재 반품 matReturns. PK=no.
 * 반품/환수 내역 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * (와이어프레임 wms-screens.jsx 의 인라인 mock 이관)
 */
export const MR_TYPES = ['협력사 반품', '창고 환수'] as const;
export const MR_STATUS = ['진행중', '처리완료'] as const;

export const matReturnSchema = z.object({
  /** 반품번호 RT-YYMMDD-NN. PK. */
  no: z.string().min(1, '반품번호는 필수입니다'),
  /** 품목 코드. */
  code: z.string().min(1, '품목 코드는 필수입니다'),
  /** 품목명. */
  name: z.string().min(1, '품목명은 필수입니다'),
  /** 반품 유형 — 협력사 반품 / 창고 환수. */
  type: z.enum(MR_TYPES),
  /** 대상(협력사명 또는 창고명). */
  vendor: z.string().default(''),
  /** 반품 수량. */
  qty: z.string().default(''),
  /** 반품 사유. */
  reason: z.string().default(''),
  /** 처리 상태 — 진행중 / 처리완료. */
  status: z.enum(MR_STATUS),
  /** 화면 선택 강조 행 여부. */
  urgent: z.boolean().optional(),
});

export type MatReturn = z.infer<typeof matReturnSchema>;
