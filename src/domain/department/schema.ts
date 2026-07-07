import { z } from 'zod';

/**
 * 부서(Department) 도메인 스키마 — 단일 진실 공급원(SSOT).
 *
 * 그룹웨어 조직도의 부서 트리 + 전자결재 합의/전결 라우팅(부서장)의 원천.
 * `users.dept`(자유문자열)를 표준 부서명으로 정렬하고, parentId 로 계층을,
 * headUserId 로 부서장을 부여한다.
 * ([[groupware-feature]] · docs/전자결재_워크플로_개발_계획서.md §3.2)
 * RDB 이관 시 이 정의가 곧 테이블 DDL. ([[DB_이관_대비_설계원칙.md]])
 */
export const departmentSchema = z.object({
  /** 부서 ID(PK, `D###`). */
  id: z.string().min(1),
  /** 부서명 — `users.dept` 와 매칭되는 표준명. */
  name: z.string().min(1, '부서명은 필수입니다'),
  /** 상위 부서 ID(FK, nullable) → 트리 계층. 최상위는 null. */
  parentId: z.string().nullable().default(null),
  /** 부서장 users.id(FK, nullable) → 합의/전결 라우팅. */
  headUserId: z.string().nullable().default(null),
  /** 형제 정렬 순서. */
  order: z.number().default(0),
});

export type Department = z.infer<typeof departmentSchema>;
