import { z } from 'zod';

/**
 * IQC 연동(입고보류→가용) iqcLinks. PK=lot. 조회전용.
 *
 * 입고된 Lot이 수입검사(IQC)를 거쳐 가용재고(Available Stock)로 전환되는
 * 상태를 보여주는 조회 마스터. (와이어프레임 wms-screens-4.jsx 정본)
 */
export const iqcLinkSchema = z.object({
  /** 추적번호(Lot). PK. */
  lot: z.string().min(1, '추적번호(Lot)는 필수입니다'),
  /** 품목 코드. */
  code: z.string().min(1, '품목 코드는 필수입니다'),
  /** 품목명. */
  name: z.string().min(1, '품목명은 필수입니다'),
  /** 입고수량. */
  qty: z.number(),
  /** IQC 상태 — IQC 대기 / IQC 진행 / IQC 합격 / IQC 불합격. */
  iqcStatus: z.string().min(1),
  /** 가용재고 반영 여부(가용전환). */
  available: z.boolean().default(false),
  /** 처리 상태 문구 — 검사대기 / 검사중 / 가용전환 / 보류·반품. */
  status: z.string().default(''),
});

export type IqcLink = z.infer<typeof iqcLinkSchema>;
