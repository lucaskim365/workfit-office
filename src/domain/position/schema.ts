import { z } from 'zod';

/**
 * 직급(Position) 도메인 스키마 — 단일 진실 공급원(SSOT).
 *
 * `users.position`(자유문자열)의 표준명과 **서열(rank)** 을 데이터화한다.
 * 동적 결재선 룰 엔진이 기안자 직급 범위 매칭·상향 탐색(POSITION_AT_LEAST)에 사용.
 * ([[dynamic-route-engine]] · docs/동적_결재선_룰엔진_개발_계획서.md §5.2)
 * RDB 이관 시 이 정의가 곧 테이블 DDL. ([[DB_이관_대비_설계원칙.md]])
 */
export const positionSchema = z.object({
  /** 직급 ID(PK, `P##`). */
  id: z.string().min(1),
  /** 직급명 — `users.position` 과 매칭되는 표준명. */
  name: z.string().min(1, '직급명은 필수입니다'),
  /** 서열 — 작을수록 상위(대표=1 … 사원=9). 직급범위 비교 키. */
  rank: z.number().int().min(1),
  /** 부서 책임자 직급 여부(팀장·공장장 등 판정 보조). */
  isDeptHead: z.boolean().default(false),
});

export type Position = z.infer<typeof positionSchema>;
