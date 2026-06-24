import { z } from 'zod';

/**
 * PQC 공정 순회(Patrol) 검사 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 PQC 순회검사 pqcPatrols. PK=id. 조회전용.
 * 라운드(헤더) + stops(점검 지점) 임베드 구조. 상태머신 없음.
 */

/** 순회 지점 점검결과 — 표준 점검항목 코드별 OK(1)/NG(0). 미점검 지점은 null. */
const checksSchema = z.record(z.string(), z.number()).nullable();

/** 순회 지점(stop) — 라운드 1회의 단일 점검 지점. */
export const pqcPatrolStopSchema = z.object({
  line: z.string(),
  proc: z.string(),
  equip: z.string(),
  time: z.string(),
  /** 점검결과 객체(항목코드→0/1) 또는 미점검 null. */
  c: checksSchema,
  note: z.string().optional(),
});
export type PqcPatrolStop = z.infer<typeof pqcPatrolStopSchema>;

export const pqcPatrolSchema = z.object({
  /** PK = 순회 ID. */
  id: z.string().min(1, '순회 ID는 필수입니다'),
  time: z.string(),
  route: z.string(),
  pic: z.string(),
  status: z.string(),
  dur: z.string(),
  stops: z.array(pqcPatrolStopSchema).default([]),
});

export type PqcPatrol = z.infer<typeof pqcPatrolSchema>;
