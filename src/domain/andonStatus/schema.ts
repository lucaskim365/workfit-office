import { z } from 'zod';

/**
 * 설비 안돈 모니터링 andonStatus. PK=code. 조회전용.
 * 실시간 설비 가동(Andon) 보드의 설비별 상태 — 설비 1대 = 1 도큐먼트.
 * 와이어프레임 equip-andon.jsx 의 인라인 BOARD 를 평탄화한 조회 마스터.
 */

/** 설비 안돈 상태 — 가동/대기/정지/고장/점검. */
export const ANDON_ST = ['RUN', 'IDLE', 'STOP', 'DOWN', 'PM'] as const;

export const andonStatusSchema = z.object({
  /** 소속 라인. */
  line: z.string().min(1),
  /** 설비 코드(PK·문서 ID). */
  code: z.string().min(1),
  /** 설비명. */
  name: z.string().min(1),
  /** 안돈 상태. */
  st: z.enum(ANDON_ST),
  /** 진행 LOT 번호(없으면 '—'). */
  lot: z.string().default('—'),
  /** 생산 품목 / 비고. */
  prod: z.string().default(''),
  /** 공정 단계 표기. */
  step: z.string().default('—'),
  /** 진행률(%). */
  prog: z.number().default(0),
  /** 누적 가동시간(HH:MM). */
  run: z.string().default(''),
  /** 사이클 타임 표기. */
  cy: z.string().default(''),
  /** 설비종합효율 OEE(%). */
  oee: z.number().default(0),
});

export type AndonStatus = z.infer<typeof andonStatusSchema>;
