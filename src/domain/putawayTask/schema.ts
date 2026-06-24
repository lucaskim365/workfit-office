import { z } from 'zod';

/**
 * 입고 적치(Putaway) putawayTasks. PK=lot. 조회전용.
 *
 * 와이어프레임 wms-screens.jsx 적치 지시/등록(Put-away) 인라인 ROWS 정본.
 * 6컬럼 매핑: 추적번호(lot)·품목(code)·현재위치(from)·추천 적치위치(to)·단위(unit)·상태(status).
 */
export const PUTAWAY_STATUS = ['대기', '진행', '완료'] as const;

export const putawayTaskSchema = z.object({
  /** 추적번호(LOT) — 고유 PK. */
  lot: z.string().min(1, '추적번호는 필수입니다'),
  /** 품목 코드. */
  code: z.string().min(1, '품목은 필수입니다'),
  /** 현재 위치(입고장 등). */
  from: z.string().default('입고장'),
  /** 추천 적치 위치(로케이션 코드). */
  to: z.string().min(1, '적치 위치는 필수입니다'),
  /** 보관 단위(Pallet·Box 등). */
  unit: z.string().default(''),
  /** 적치 상태. */
  status: z.enum(PUTAWAY_STATUS).default('대기'),
});

export type PutawayTask = z.infer<typeof putawayTaskSchema>;
