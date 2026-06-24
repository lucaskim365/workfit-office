import { z } from 'zod';

/**
 * 피킹 리스트 pickingList. PK=id. 조회전용.
 *
 * 자재 피킹 지시/작업 화면의 FIFO 피킹 리스트 1행 = 1 도큐먼트.
 * 7컬럼: 순번(seq)·품목(code)·지정 Lot(lot)·피킹 위치(loc)·입고일(inDate)·수량(qty)·룰(rule).
 * 원본 ROWS에 자연 PK가 없어 결정적 id(`PK-01`~)를 부여한다.
 */
export const pickingListSchema = z.object({
  /** 결정적 문서 PK. */
  id: z.string().min(1, '문서 ID는 필수입니다'),
  /** 순번(표시용). */
  seq: z.string().min(1),
  /** 품목 코드. */
  code: z.string().min(1),
  /** 지정 Lot 번호(FIFO 선정). */
  lot: z.string().min(1),
  /** 피킹 위치(로케이션). */
  loc: z.string().min(1),
  /** 입고일(YYYY-MM-DD). */
  inDate: z.string().min(1),
  /** 지시 수량(표시 문자열). */
  qty: z.string().min(1),
  /** 피킹 룰(예: FIFO). */
  rule: z.string().min(1),
});

export type PickingList = z.infer<typeof pickingListSchema>;
