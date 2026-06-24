import { z } from 'zod';

/**
 * 자재 폐기(MatScrap) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 로그 마스터: 폐기 품의·창고 반출 1건 = 1 도큐먼트. PK=no.
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 컬렉션 matScraps. (와이어프레임 wms-screens-4.jsx 인라인 ROWS 이관)
 */
export const matScrapSchema = z.object({
  /** 폐기번호(PK·문서ID). 예: SC-260611-02 */
  no: z.string().min(1, '폐기번호는 필수입니다'),
  /** 품목 코드. 예: RES-PR-19 */
  code: z.string().min(1, '품목 코드는 필수입니다'),
  /** 품목명. */
  name: z.string().min(1, '품목명은 필수입니다'),
  /** Lot 번호. */
  lot: z.string().default(''),
  /** 폐기 수량. */
  qty: z.number().default(0),
  /** 폐기 사유. 예: 보존기한 만료 */
  reason: z.string().default(''),
  /** 품의(승인) 상태. 예: 승인완료 / 승인대기 / 반려 */
  approval: z.string().default(''),
  /** 반출 상태. 예: 반출완료 / 반출대기 / 대기 / 종결 */
  status: z.string().default(''),
  /** 긴급/선택 강조 행 여부. */
  urgent: z.boolean().optional(),
});

export type MatScrap = z.infer<typeof matScrapSchema>;
