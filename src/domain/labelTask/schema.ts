import { z } from 'zod';

/**
 * 라벨 발행 labelTasks. PK=lot. 조회전용.
 * 입고 자재 단위(Box·Pallet) 라벨 발행 대상 마스터.
 * (와이어프레임 wms-screens.jsx 의 인라인 ROWS 이관)
 */
export const LABEL_TYPES = ['RFID', '바코드'] as const;
export const LABEL_STATUS = ['발행완료', '대기'] as const;

export const labelTaskSchema = z.object({
  /** 추적번호(Lot) — 고유 PK. */
  lot: z.string().min(1, '추적번호(Lot)는 필수입니다'),
  /** 품목 코드. */
  code: z.string().min(1, '품목은 필수입니다'),
  /** 발행 단위(Box·Pallet 등). */
  unit: z.string().default(''),
  /** 발행 수량. */
  qty: z.string().default(''),
  /** 라벨 유형(RFID·바코드). */
  labelType: z.enum(LABEL_TYPES),
  /** 발행 상태. */
  status: z.enum(LABEL_STATUS),
});

export type LabelTask = z.infer<typeof labelTaskSchema>;
