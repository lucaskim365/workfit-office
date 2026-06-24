import { z } from 'zod';

/**
 * 파렛트/용기 pallets. PK=id. 조회전용.
 *
 * 이동 용기(파렛트·대차·매거진) 추적 마스터 — 와이어프레임 wms-screens-3.jsx 정본.
 * 도큐먼트 1건 = 용기 1개. RDB 이관 시 이 정의가 곧 테이블 DDL이 된다.
 */
export const palletSchema = z.object({
  /** 용기번호(PK). PLT-/CRT-/MAG- 접두. */
  id: z.string().min(1, '용기번호는 필수입니다'),
  /** 용기 유형 — Pallet/대차/매거진 등. */
  type: z.string().min(1),
  /** 적재 품목 코드. 비적재 시 '—'. */
  code: z.string().default('—'),
  /** 적재 Lot. 비적재 시 '—'. */
  lot: z.string().default('—'),
  /** 현재 위치(로케이션). */
  loc: z.string().default('—'),
  /** 상태 — 사용중/공용기 등. */
  status: z.string().min(1),
  /** 강조(선택/주목) 행 여부. 표시 전용. */
  urgent: z.boolean().optional(),
});

export type Pallet = z.infer<typeof palletSchema>;
