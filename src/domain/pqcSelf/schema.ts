import { z } from 'zod';

/**
 * PQC 자주검사(PqcSelf) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 PQC 자주검사 `pqcSelfChecks`. PK=wo. 조회전용.
 */

/** 검사 회차(round) — 자주검사 1회분 측정 결과(임베드). */
export const roundSchema = z.object({
  r: z.number(),
  time: z.string(),
  val: z.number(),
  n: z.number(),
  ng: z.number(),
  st: z.string(),
});
export type Round = z.infer<typeof roundSchema>;

export const pqcSelfSchema = z.object({
  wo: z.string().min(1, '작업지시 번호는 필수입니다'),
  item: z.string(),
  code: z.string(),
  line: z.string(),
  equip: z.string(),
  proc: z.string(),
  qty: z.number(),
  done: z.number(),
  op: z.string(),
  cycle: z.string(),
  interval: z.string(),
  next: z.number(),
  adher: z.number(),
  char: z.string(),
  unit: z.string(),
  target: z.number(),
  usl: z.number(),
  lsl: z.number(),
  rounds: z.array(roundSchema).default([]),
});

export type PqcSelf = z.infer<typeof pqcSelfSchema>;
